const form = document.querySelector("#course-form");
const courseList = document.querySelector("#course-list");
const emptyState = document.querySelector("#empty-state");
const courseCount = document.querySelector("#course-count");
const message = document.querySelector("#message");

function showMessage(text, isError = false) {
  message.textContent = text;
  message.classList.toggle("error", isError);
}

async function loadCourses() {
  const response = await fetch("/api/courses");
  if (!response.ok) {
    throw new Error("Could not load courses.");
  }

  const courses = await response.json();
  courseList.replaceChildren();

  for (const course of courses) {
    const row = document.createElement("tr");
    for (const value of [
      course.courseId,
      course.courseName,
      course.courseCode,
      course.department
    ]) {
      const cell = document.createElement("td");
      cell.textContent = value;
      row.append(cell);
    }

    const actions = document.createElement("td");
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "delete-button";
    deleteButton.textContent = "Delete";
    deleteButton.setAttribute("aria-label", `Delete course ${course.courseId}`);
    deleteButton.addEventListener("click", () => deleteCourse(course.courseId));
    actions.append(deleteButton);
    row.append(actions);
    courseList.append(row);
  }

  emptyState.hidden = courses.length > 0;
  courseCount.textContent = `${courses.length} ${courses.length === 1 ? "course" : "courses"}`;
}

async function deleteCourse(courseId) {
  try {
    const response = await fetch(`/api/courses/${encodeURIComponent(courseId)}`, {
      method: "DELETE"
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not delete the course.");
    }

    showMessage("Course deleted.");
    await loadCourses();
  } catch (error) {
    showMessage(error.message, true);
  }
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const course = Object.fromEntries(new FormData(form));

  try {
    const response = await fetch("/api/courses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(course)
    });
    const result = await response.json();
    if (!response.ok) {
      throw new Error(result.error || "Could not add the course.");
    }

    form.reset();
    showMessage("Course added.");
    await loadCourses();
  } catch (error) {
    showMessage(error.message, true);
  }
});

loadCourses().catch((error) => showMessage(error.message, true));
