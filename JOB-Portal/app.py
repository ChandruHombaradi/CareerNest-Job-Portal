from flask import (
    Flask, render_template, request, jsonify,
    redirect, url_for, session, g
)
import sqlite3
from datetime import datetime
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)

DB_NAME = "jobs.db"
app.secret_key = "change-this-to-a-random-secret"  # important for sessions


# ------------------ DB HELPERS ------------------

def get_db():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row

    # users table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT NOT NULL UNIQUE,
            password_hash TEXT NOT NULL,
            role TEXT NOT NULL CHECK (role IN ('candidate', 'recruiter', 'admin'))
        )
    """)

    # jobs table: now also stores which user posted the job
    conn.execute("""
        CREATE TABLE IF NOT EXISTS jobs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT NOT NULL,
            company TEXT NOT NULL,
            location TEXT,
            job_type TEXT,
            salary TEXT,
            description TEXT,
            created_at TEXT NOT NULL,
            posted_by_user_id INTEGER,
            FOREIGN KEY (posted_by_user_id) REFERENCES users(id)
        )
    """)

    # applications table
    conn.execute("""
        CREATE TABLE IF NOT EXISTS applications (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_id INTEGER NOT NULL,
            name TEXT NOT NULL,
            email TEXT NOT NULL,
            resume_url TEXT,
            cover_letter TEXT,
            applied_at TEXT NOT NULL,
            FOREIGN KEY (job_id) REFERENCES jobs(id) ON DELETE CASCADE
        )
    """)

    return conn


def get_user_by_id(user_id):
    if not user_id:
        return None
    conn = get_db()
    user = conn.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    conn.close()
    return user


@app.before_request
def load_logged_in_user():
    user_id = session.get("user_id")
    g.user = get_user_by_id(user_id) if user_id else None


def login_required(roles=None):
    """
    Usage:
    - @login_required() -> any logged-in user
    - @login_required(roles=['recruiter', 'admin']) -> only those roles
    """
    def decorator(view):
        def wrapped_view(*args, **kwargs):
            if g.user is None:
                return redirect(url_for("login", next=request.path))

            if roles and g.user["role"] not in roles:
                return redirect(url_for("index"))

            return view(*args, **kwargs)
        wrapped_view.__name__ = view.__name__
        return wrapped_view
    return decorator


# ------------------ AUTH ROUTES ------------------

@app.route("/register", methods=["GET", "POST"])
def register():
    error = None
    if request.method == "POST":
        name = request.form.get("name", "").strip()
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")
        role = request.form.get("role", "candidate")

        if not name or not email or not password:
            error = "All fields are required."
        elif role not in ("candidate", "recruiter"):
            error = "Invalid role."
        else:
            conn = get_db()
            existing = conn.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
            if existing:
                error = "Email already registered. Please login."
            else:
                password_hash = generate_password_hash(password)
                conn.execute(
                    "INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)",
                    (name, email, password_hash, role)
                )
                conn.commit()
                user_id = conn.execute(
                    "SELECT id FROM users WHERE email = ?", (email,)
                ).fetchone()["id"]
                conn.close()
                session["user_id"] = user_id
                return redirect(url_for("index"))

            conn.close()

    return render_template("register.html", error=error)


@app.route("/login", methods=["GET", "POST"])
def login():
    error = None
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        conn = get_db()
        user = conn.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
        conn.close()

        if user is None or not check_password_hash(user["password_hash"], password):
            error = "Invalid email or password."
        else:
            session.clear()
            session["user_id"] = user["id"]
            next_page = request.args.get("next") or url_for("index")
            return redirect(next_page)

    return render_template("login.html", error=error)


@app.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("index"))


# ------------------ MAIN PAGES ------------------

@app.route("/")
def index():
    return render_template("index.html")


@app.route("/jobs/post")
@login_required(roles=["recruiter", "admin"])
def post_job_page():
    return render_template("post_job.html")


@app.route("/admin")
@login_required(roles=["admin"])
def admin_page():
    conn = get_db()
    rows = conn.execute("""
        SELECT a.id AS app_id, a.name, a.email, a.resume_url, a.cover_letter,
               a.applied_at,
               j.title AS job_title, j.company, j.location
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        ORDER BY a.applied_at DESC
    """).fetchall()
    conn.close()
    applications = [dict(r) for r in rows]
    return render_template("admin.html", applications=applications)


# -------- Candidate: My Applications Page --------

@app.route("/my-applications")
@login_required(roles=["candidate"])
def my_applications():
    """Show jobs that this candidate has applied to (by their email)."""
    conn = get_db()
    rows = conn.execute("""
        SELECT a.id AS app_id, a.applied_at, a.resume_url, a.cover_letter,
               j.title AS job_title, j.company, j.location
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE LOWER(a.email) = LOWER(?)
        ORDER BY a.applied_at DESC
    """, (g.user["email"],)).fetchall()
    conn.close()
    apps = [dict(r) for r in rows]
    return render_template("candidate_applications.html", applications=apps)


# -------- Recruiter: Applications for My Jobs --------

@app.route("/recruiter/applications")
@login_required(roles=["recruiter", "admin"])
def recruiter_applications():
    """Show applications for jobs posted by this recruiter."""
    conn = get_db()
    rows = conn.execute("""
        SELECT a.id AS app_id, a.name, a.email, a.resume_url, a.cover_letter,
               a.applied_at,
               j.title AS job_title, j.company, j.location
        FROM applications a
        JOIN jobs j ON a.job_id = j.id
        WHERE j.posted_by_user_id = ?
        ORDER BY a.applied_at DESC
    """, (g.user["id"],)).fetchall()
    conn.close()
    apps = [dict(r) for r in rows]
    return render_template("recruiter_applications.html", applications=apps)


# ------------------ JOB APIs ------------------

@app.route("/api/jobs", methods=["GET"])
def get_jobs():
    conn = get_db()
    rows = conn.execute("""
        SELECT * FROM jobs
        ORDER BY datetime(created_at) DESC
    """).fetchall()
    conn.close()

    jobs = [dict(r) for r in rows]
    return jsonify(jobs)


@app.route("/api/jobs", methods=["POST"])
@login_required(roles=["recruiter", "admin"])
def create_job():
    data = request.get_json() or request.form

    title = data.get("title", "").strip()
    company = data.get("company", "").strip()
    location = data.get("location", "").strip()
    job_type = data.get("job_type", "").strip()
    salary = data.get("salary", "").strip()
    description = data.get("description", "").strip()

    if not title or not company:
        return jsonify({"error": "Title and company are required"}), 400

    conn = get_db()
    conn.execute("""
        INSERT INTO jobs (title, company, location, job_type, salary, description,
                          created_at, posted_by_user_id)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        title, company, location, job_type, salary, description,
        datetime.now().isoformat(), g.user["id"]
    ))
    conn.commit()
    conn.close()

    return jsonify({"message": "Job posted successfully"}), 201


# ------------------ APPLICATION APIs ------------------

@app.route("/api/jobs/<int:job_id>/apply", methods=["POST"])
def apply_to_job(job_id):
    data = request.get_json() or request.form

    name = data.get("name", "").strip()
    email = data.get("email", "").strip()
    resume_url = data.get("resume_url", "").strip()
    cover_letter = data.get("cover_letter", "").strip()

    if not name or not email:
        return jsonify({"error": "Name and email are required"}), 400

    conn = get_db()

    job = conn.execute("SELECT id FROM jobs WHERE id = ?", (job_id,)).fetchone()
    if not job:
        conn.close()
        return jsonify({"error": "Job not found"}), 404

    conn.execute("""
        INSERT INTO applications (job_id, name, email, resume_url, cover_letter, applied_at)
        VALUES (?, ?, ?, ?, ?, ?)
    """, (job_id, name, email, resume_url, cover_letter, datetime.now().isoformat()))
    conn.commit()
    conn.close()

    # Here you could also send an email to recruiter if you wanted.
    return jsonify({"message": "Application submitted successfully"}), 201


if __name__ == "__main__":
    app.run(debug=True)
