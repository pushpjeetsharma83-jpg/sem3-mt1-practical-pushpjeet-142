const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT) || 3000;
const DATA_FILE = path.join(__dirname, "courses.json");
const MAX_BODY_SIZE = 16 * 1024;
const staticFiles = {
  "/": ["index.html", "text/html; charset=utf-8"],
  "/index.html": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.js": ["app.js", "text/javascript; charset=utf-8"]
};

function sendJson(response, statusCode, data) {
  response.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
  response.end(JSON.stringify(data));
}

function readCourses() {
  return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    let tooLarge = false;

    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (Buffer.byteLength(body) + Buffer.byteLength(chunk) > MAX_BODY_SIZE) {
        tooLarge = true;
      } else if (!tooLarge) {
        body += chunk;
      }
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body is too large."), { statusCode: 413 }));
        return;
      }

      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON."), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

async function handleRequest(request, response) {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);

  if (url.pathname === "/api/courses" && request.method === "GET") {
    sendJson(response, 200, readCourses());
    return;
  }

  if (url.pathname === "/api/courses" && request.method === "POST") {
    const course = await readRequestBody(request);
    const fields = ["courseId", "courseName", "courseCode", "department"];

    if (!course || fields.some((field) => typeof course[field] !== "string" || !course[field].trim())) {
      sendJson(response, 400, { error: "Please provide a course ID, name, code, and department." });
      return;
    }

    const newCourse = Object.fromEntries(fields.map((field) => [field, course[field].trim()]));
    const courses = readCourses();
    if (courses.some((existing) => existing.courseId.toLowerCase() === newCourse.courseId.toLowerCase())) {
      sendJson(response, 409, { error: "A course with that ID already exists." });
      return;
    }

    courses.push(newCourse);
    fs.writeFileSync(DATA_FILE, `${JSON.stringify(courses, null, 2)}\n`);
    sendJson(response, 201, newCourse);
    return;
  }

  if (url.pathname.startsWith("/api/courses/") && request.method === "DELETE") {
    let courseId;
    try {
      courseId = decodeURIComponent(url.pathname.slice("/api/courses/".length));
    } catch {
      sendJson(response, 400, { error: "Invalid course ID." });
      return;
    }

    const courses = readCourses();
    const remainingCourses = courses.filter((course) => course.courseId !== courseId);
    if (remainingCourses.length === courses.length) {
      sendJson(response, 404, { error: "Course not found." });
      return;
    }

    fs.writeFileSync(DATA_FILE, `${JSON.stringify(remainingCourses, null, 2)}\n`);
    sendJson(response, 200, { message: "Course deleted." });
    return;
  }

  const staticFile = staticFiles[url.pathname];
  if (request.method === "GET" && staticFile) {
    const [fileName, contentType] = staticFile;
    response.writeHead(200, { "Content-Type": contentType });
    response.end(fs.readFileSync(path.join(__dirname, fileName)));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    sendJson(response, 404, { error: "API route not found." });
    return;
  }

  response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
  response.end("Not found");
}

const server = http.createServer((request, response) => {
  handleRequest(request, response).catch((error) => {
    console.error(error);
    if (!response.headersSent) {
      sendJson(response, error.statusCode || 500, {
        error: error.statusCode ? error.message : "Server error."
      });
    } else {
      response.destroy();
    }
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log(`Course Manager is running at http://localhost:${PORT}`);
});
