# Contributing to DataLabel

Thank you for your interest in contributing to **DataLabel**, an open-source project by **SPManchester Private Limited** under the engineering leadership of **Sayed Mudassar Akbar**.

We welcome contributions from the developer and machine learning community to enhance annotation workflows, agreement mathematics, and platform capabilities.

---

## Code of Conduct

All contributors and maintainers are expected to uphold a professional, respectful, and collaborative environment. Please review our community standards outlined in [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md).

---

## How to Contribute

### 1. Issue Reporting
- Search existing GitHub issues before creating a new one to avoid duplicates.
- For bug reports, use the provided bug report template with system details, expected behavior, and reproducible test cases.
- For feature requests, clearly articulate the user problem, use case, and proposed interface.

### 2. Development Setup
1. Ensure **Node.js (>= 22.5.0)** is installed on your workstation.
2. Clone your fork of the repository:
   ```bash
   git clone https://github.com/your-username/spm-aidev-datalabel.git
   cd spm-aidev-datalabel
   ```
3. Run the built-in syntax check:
   ```bash
   npm run check
   ```
4. Execute the automated test suite:
   ```bash
   npm test
   ```

### 3. Engineering Guidelines
- **Zero External Dependencies:** The backend relies strictly on Node.js standard libraries (`node:http`, `node:sqlite`, `node:crypto`). Do not introduce external npm runtime dependencies.
- **Deterministic Mathematics:** Pure calculation logic must reside in `backend/src/ai/engine.js` with 100% deterministic test coverage and zero floating-point ambiguities (enforcing 4-decimal place rounding).
- **Multi-tenant Project Scoping:** All database queries must be explicitly scoped by `project_id`. Cross-project access must strictly return HTTP 404.

### 4. Git Commit Conventions
Follow conventional commit formatting for clear project history:
- `feat:` Introduces a new feature or endpoint
- `fix:` Fixes a bug or edge-case handling
- `docs:` Documentation improvements or additions
- `test:` Adds or refactors automated tests
- `refactor:` Code improvements without altering external behavior

### 5. Pull Request Process
1. Create a dedicated topic branch: `git checkout -b feature/my-enhancement`.
2. Ensure all syntax checks and tests pass with 0 failures:
   ```bash
   npm run check && npm test
   ```
3. Submit a Pull Request targeting the `main` branch.
4. Complete all checklist items in the pull request template.

---

## Questions & Enterprise Support

For questions, architectural guidance, or custom enterprise deployments:
- **Email:** [info@spmanchester.com](mailto:info@spmanchester.com)
- **Website:** [www.spmanchester.com](https://www.spmanchester.com)
- **Maintainer:** Sayed Mudassar Akbar
