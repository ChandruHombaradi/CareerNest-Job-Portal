// ===================================================================
//                 ELEMENT REFERENCES (MAY BE NULL)
// ===================================================================

// Job listing page (index.html)
var jobsContainer = document.getElementById("jobs-container");
var noJobsEl = document.getElementById("no-jobs");

var keywordInput = document.getElementById("search-keyword");
var locationInput = document.getElementById("search-location");
var filterBtn = document.getElementById("btn-filter");
var clearBtn = document.getElementById("btn-clear");

// Apply modal elements (only exist on index.html)
var applyModal = document.getElementById("apply-modal");
var applyJobTitle = document.getElementById("apply-job-title");
var applyJobIdInput = document.getElementById("apply-job-id");
var applyNameInput = document.getElementById("apply-name");
var applyEmailInput = document.getElementById("apply-email");
var applyResumeInput = document.getElementById("apply-resume");
var applyCoverInput = document.getElementById("apply-cover");
var applyMessage = document.getElementById("apply-message");
var applyForm = document.getElementById("apply-form");
var cancelApplyBtn = document.getElementById("btn-cancel-apply");

// Post job elements (only exist on post_job.html)
var postJobForm = document.getElementById("post-job-form");
var postJobMsg = document.getElementById("post-job-message");


// ===================================================================
//                         JOB LISTING
// ===================================================================

var allJobs = [];

// Fetch jobs from backend API
function fetchJobs() {
  if (!jobsContainer) return; // not on jobs page

  fetch("/api/jobs")
    .then(function (res) {
      if (!res.ok) {
        throw new Error("Failed to fetch jobs");
      }
      return res.json();
    })
    .then(function (data) {
      allJobs = data;
      renderJobs();
    })
    .catch(function (err) {
      console.error(err);
    });
}

// Render jobs with filters
function renderJobs() {
  if (!jobsContainer) return;

  jobsContainer.innerHTML = "";

  var keyword = "";
  var location = "";

  if (keywordInput) {
    keyword = keywordInput.value.toLowerCase();
  }
  if (locationInput) {
    location = locationInput.value.toLowerCase();
  }

  var filtered = allJobs.filter(function (job) {
    var text = (job.title + " " + job.company + " " + (job.description || "")).toLowerCase();
    var loc = (job.location || "").toLowerCase();

    var keywordMatch = keyword === "" || text.indexOf(keyword) !== -1;
    var locationMatch = location === "" || loc.indexOf(location) !== -1;

    return keywordMatch && locationMatch;
  });

  if (filtered.length === 0) {
    if (noJobsEl) noJobsEl.style.display = "block";
    return;
  } else {
    if (noJobsEl) noJobsEl.style.display = "none";
  }

  filtered.forEach(function (job) {
    var card = document.createElement("div");
    card.className = "job-card";

    var header = document.createElement("div");
    header.className = "job-header";

    var left = document.createElement("div");

    var titleEl = document.createElement("div");
    titleEl.className = "job-title";
    titleEl.textContent = job.title;

    var companyEl = document.createElement("div");
    companyEl.className = "job-company";
    companyEl.textContent = job.company;

    left.appendChild(titleEl);
    left.appendChild(companyEl);

    var createdEl = document.createElement("div");
    createdEl.className = "muted";
    createdEl.style.fontSize = "0.8rem";
    createdEl.textContent = "Posted";

    header.appendChild(left);
    header.appendChild(createdEl);

    var meta = document.createElement("div");
    meta.className = "job-meta";

    if (job.location) {
      var locSpan = document.createElement("span");
      locSpan.className = "badge";
      locSpan.textContent = job.location;
      meta.appendChild(locSpan);
    }

    if (job.job_type) {
      var typeSpan = document.createElement("span");
      typeSpan.className = "badge";
      typeSpan.textContent = job.job_type;
      meta.appendChild(typeSpan);
    }

    if (job.salary) {
      var salarySpan = document.createElement("span");
      salarySpan.className = "badge";
      salarySpan.textContent = job.salary;
      meta.appendChild(salarySpan);
    }

    var desc = document.createElement("div");
    desc.className = "job-desc";

    if (job.description) {
      if (job.description.length > 140) {
        desc.textContent = job.description.slice(0, 140) + "...";
      } else {
        desc.textContent = job.description;
      }
    } else {
      desc.textContent = "No description provided.";
    }

    var actions = document.createElement("div");
    actions.className = "job-actions";

    var applyBtn = document.createElement("button");
    applyBtn.textContent = "Apply";
    applyBtn.onclick = function () {
      openApplyModal(job);
    };

    actions.appendChild(applyBtn);

    card.appendChild(header);
    card.appendChild(meta);
    card.appendChild(desc);
    card.appendChild(actions);

    jobsContainer.appendChild(card);
  });
}

// Filter buttons
if (filterBtn) {
  filterBtn.addEventListener("click", function () {
    renderJobs();
  });
}

if (clearBtn) {
  clearBtn.addEventListener("click", function () {
    if (keywordInput) keywordInput.value = "";
    if (locationInput) locationInput.value = "";
    renderJobs();
  });
}


// ===================================================================
//                           APPLY MODAL
// ===================================================================

function openApplyModal(job) {
  if (!applyModal) return;

  if (applyJobTitle) {
    applyJobTitle.textContent = "Apply for " + job.title + " @ " + job.company;
  }
  if (applyJobIdInput) applyJobIdInput.value = job.id;

  if (applyNameInput) applyNameInput.value = "";
  if (applyEmailInput) applyEmailInput.value = "";
  if (applyResumeInput) applyResumeInput.value = "";
  if (applyCoverInput) applyCoverInput.value = "";
  if (applyMessage) applyMessage.textContent = "";

  applyModal.classList.remove("hidden");
}

function closeApplyModal() {
  if (!applyModal) return;
  applyModal.classList.add("hidden");
}

// Cancel button
if (cancelApplyBtn) {
  cancelApplyBtn.addEventListener("click", function () {
    closeApplyModal();
  });
}

// Close when clicking backdrop
if (applyModal) {
  var backdrop = applyModal.querySelector(".modal-backdrop");
  if (backdrop) {
    backdrop.addEventListener("click", function () {
      closeApplyModal();
    });
  }
}

// Submit application
if (applyForm) {
  applyForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (applyMessage) applyMessage.textContent = "";

    var jobId = applyJobIdInput ? applyJobIdInput.value : null;

    var payload = {
      name: applyNameInput ? applyNameInput.value.trim() : "",
      email: applyEmailInput ? applyEmailInput.value.trim() : "",
      resume_url: applyResumeInput ? applyResumeInput.value.trim() : "",
      cover_letter: applyCoverInput ? applyCoverInput.value.trim() : ""
    };

    if (!payload.name || !payload.email) {
      if (applyMessage) applyMessage.textContent = "Name and email are required.";
      return;
    }

    fetch("/api/jobs/" + jobId + "/apply", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          if (applyMessage) applyMessage.textContent = "Application submitted ✅";
          setTimeout(function () {
            closeApplyModal();
          }, 1200);
        } else {
          if (applyMessage) {
            applyMessage.textContent = result.data.error || "Failed to submit application.";
          }
        }
      })
      .catch(function (err) {
        console.error(err);
        if (applyMessage) applyMessage.textContent = "Something went wrong.";
      });
  });
}


// ===================================================================
//                      POST JOB (RECRUITER PAGE)
// ===================================================================

if (postJobForm) {
  postJobForm.addEventListener("submit", function (e) {
    e.preventDefault();
    if (postJobMsg) postJobMsg.textContent = "";

    var titleEl = document.getElementById("job-title");
    var companyEl = document.getElementById("job-company");
    var locationEl = document.getElementById("job-location");
    var typeEl = document.getElementById("job-type");
    var salaryEl = document.getElementById("job-salary");
    var descEl = document.getElementById("job-description");

    var title = titleEl ? titleEl.value.trim() : "";
    var company = companyEl ? companyEl.value.trim() : "";
    var location = locationEl ? locationEl.value.trim() : "";
    var jobType = typeEl ? typeEl.value.trim() : "";
    var salary = salaryEl ? salaryEl.value.trim() : "";
    var description = descEl ? descEl.value.trim() : "";

    if (!title || !company) {
      if (postJobMsg) postJobMsg.textContent = "Title and company are required.";
      return;
    }

    var payload = {
      title: title,
      company: company,
      location: location,
      job_type: jobType,
      salary: salary,
      description: description
    };

    fetch("/api/jobs", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        return res.json().then(function (data) {
          return { ok: res.ok, data: data };
        });
      })
      .then(function (result) {
        if (result.ok) {
          if (postJobMsg) postJobMsg.textContent = "Job posted successfully ✅";
          postJobForm.reset();
        } else {
          if (postJobMsg) {
            postJobMsg.textContent = result.data.error || "Failed to post job.";
          }
        }
      })
      .catch(function (err) {
        console.error(err);
        if (postJobMsg) postJobMsg.textContent = "Something went wrong.";
      });
  });
}


// ===================================================================
//                             INIT
// ===================================================================

if (jobsContainer) {
  fetchJobs();
}
