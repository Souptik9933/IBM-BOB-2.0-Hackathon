# Deeptrace — AI-Powered Software Reliability & Root-Cause Analysis

**IBM BOB 2.0 Hackathon**

Deeptrace is an AI-powered software engineering assistant designed to help development and SRE teams investigate application failures faster.

When a system encounters an alert, bug, or unexpected behavior, Deeptrace is designed to analyze available **logs, code, application behavior, and infrastructure context** to identify potential root causes and suggest actionable fixes.

For this hackathon submission, **Studywell** is used as the target application containing intentionally seeded logic defects. Deeptrace's purpose is to help an engineering team investigate those defects rather than manually searching through the entire codebase.

---

## 🎯 Problem

Debugging software incidents can require developers to manually inspect:

* Application code
* Error messages and logs
* Recent changes
* Application behavior
* Related components
* Possible failure points

This process can be time-consuming, especially in unfamiliar or older codebases.

Deeptrace aims to provide an AI-assisted investigation workflow that can:

1. Detect suspicious behavior
2. Investigate relevant code and context
3. Identify a likely root cause
4. Explain why the issue occurs
5. Suggest a possible fix
6. Help engineers validate the proposed solution

---

## 💡 Our Solution

Deeptrace acts as a **virtual software reliability engineer** that assists developers during debugging and incident investigation.

Instead of simply generating code, the concept focuses on the reasoning process behind debugging:

**Incident → Investigation → Root Cause → Suggested Fix → Validation**

The AI is intended to use relevant project context rather than treating the entire repository as an undifferentiated prompt.

---

# 🧪 Test Application: Studywell

Studywell is a lightweight student task-planning application created as the test target for Deeptrace.

It provides a realistic software application in which bugs can be introduced, investigated, explained, and eventually fixed.

### Studywell features

* Dashboard with due-today and overdue tasks
* Completion tracking
* Subject summaries
* Task creation and editing
* Task deletion
* Task completion
* Search and filtering
* Sorting
* Task detail views
* Progress grouped by subject
* Local browser storage
* Responsive desktop/mobile interface

### Intentional Defects

The Studywell version used for the Deeptrace investigation contains **seeded logic defects intentionally introduced for testing**.

These defects are not accidental submission errors. They provide controlled scenarios for evaluating an AI-assisted debugging workflow.

---

# 🔍 Deeptrace Investigation Workflow

The intended workflow is:

```text
Studywell Application
        ↓
Observed Bug / Unexpected Behavior
        ↓
Deeptrace Investigation
        ↓
Relevant Code + Context
        ↓
Root Cause Analysis
        ↓
Suggested Fix
        ↓
Developer Validation
```

The goal is not simply to ask an AI to "fix the project."

Deeptrace is designed around the more useful engineering question:

> **Why is this behavior happening, and what evidence in the code explains it?**

---

# 🛠️ Technology

### Test Application

* React / JSX
* Vite
* JavaScript
* Browser Local Storage
* HTML/CSS

### AI Investigation

Deeptrace uses AI-assisted investigation prompts and repository context to reason about software defects, identify relevant code, and explain potential root causes.

The project is structured as a hackathon proof-of-concept rather than a production SRE platform.

---

# 🚀 Running Studywell Locally

### Requirements

* Node.js 18+
* npm

### Installation

```bash
npm install
```

### Start development server

```bash
npm run dev
```

Vite will provide the local development URL.

### Production build

```bash
npm run build
```

---

# 📁 Repository Structure

```text
.
├── src/                  # Studywell application source
├── public/               # Public assets
├── screenshots/          # Hackathon/demo screenshots
├── README.md
├── package.json
├── vite.config.*
└── ...
```

The repository also contains earlier standalone JSX/reference screens retained as project references.

The runnable Studywell implementation is self-contained and uses browser local storage instead of requiring a backend or external database.

---

# 📸 Project Evidence

Screenshots demonstrating the Studywell application and the hackathon development/investigation process are included in the repository.

The screenshots provide visual evidence of the application and the work performed during the hackathon.

---

# 🧠 Key Engineering Idea

A major focus of Deeptrace is **context-aware debugging**.

Large repositories can contain many files and large amounts of code. An effective debugging assistant should therefore focus on the parts of the system that are relevant to the observed failure.

Deeptrace's intended reasoning process is:

```text
Understand the symptom
        ↓
Locate relevant components
        ↓
Trace the execution/data flow
        ↓
Identify suspicious logic
        ↓
Explain the root cause
        ↓
Propose a fix
        ↓
Validate the result
```

This makes the system more useful than simply generating a replacement code snippet without explaining the underlying failure.

---

# 🎥 Hackathon Demonstration

The demonstration focuses on:

1. Introducing the Studywell test application
2. Showing an intentionally seeded defect
3. Using Deeptrace to investigate the issue
4. Identifying the relevant code/context
5. Explaining the suspected root cause
6. Demonstrating the proposed resolution or debugging reasoning

---

# ⚠️ Hackathon Prototype Disclaimer

Deeptrace is a **hackathon proof-of-concept** and should not be considered a production-ready SRE platform.

The Studywell application intentionally contains seeded defects so that Deeptrace can be evaluated as a software-debugging and root-cause-analysis concept.

The current implementation demonstrates the core investigation workflow and concept rather than a complete production observability stack.

---

# 👥 Team

Built for the **IBM BOB 2.0 Hackathon**.

Our team explored how AI can assist software engineers with debugging, root-cause analysis, and understanding unfamiliar codebases.

---

## 📌 Summary

**Studywell** provides the software system and controlled defects.

**Deeptrace** provides the AI-assisted investigation concept.

Together, they demonstrate how an AI engineering assistant can help developers move from:

**"Something is broken."**

to:

**"Here is what is happening, why it is happening, and where to investigate next."**
