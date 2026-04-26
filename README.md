# PermaculturaLosAndesApp

This project was generated using [Angular CLI](https://github.com/angular/angular-cli) version 21.2.7.

## Development server

To start a local development server, run:

```bash
ng serve
```

Once the server is running, open your browser and navigate to `http://localhost:4200/`. The application will automatically reload whenever you modify any of the source files.

## Code scaffolding

Angular CLI includes powerful code scaffolding tools. To generate a new component, run:

```bash
ng generate component component-name
```

For a complete list of available schematics (such as `components`, `directives`, or `pipes`), run:

```bash
ng generate --help
```

## Building

To build the project run:

```bash
ng build
```

This will compile your project and store the build artifacts in the `dist/` directory. By default, the production build optimizes your application for performance and speed.

## Running unit tests

To execute unit tests with the [Vitest](https://vitest.dev/) test runner, use the following command:

```bash
ng test
```

## Running end-to-end tests

For end-to-end (e2e) testing, run:

```bash
ng e2e
```

Angular CLI does not come with an end-to-end testing framework by default. You can choose one that suits your needs.

## Deployment

The app is hosted on Firebase Hosting at **https://permacultura-los-andes.web.app**.

To deploy a new version:

```bash
ng build && firebase deploy --only hosting
```

If you've changed `firestore.rules`, deploy those too:

```bash
ng build && firebase deploy --only hosting,firestore:rules
```

Firestore rules live in [firestore.rules](firestore.rules) — that file is the source of truth, not the Firebase console. Any console edits will be overwritten on the next deploy.

The Firebase project ID is `permacultura-los-andes` (pinned in [.firebaserc](.firebaserc)). To deploy you need to be logged in via `firebase login` with an account that has Editor/Owner access to the project.

## Additional Resources

For more information on using the Angular CLI, including detailed command references, visit the [Angular CLI Overview and Command Reference](https://angular.dev/tools/cli) page.
