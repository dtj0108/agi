import { Project, SyntaxKind } from 'ts-morph';

const [,, tsconfigPath] = process.argv;
if (!tsconfigPath) {
  console.error('Usage: node scripts/ts-migration/add-var-anys.mjs <tsconfigPath>');
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: tsconfigPath,
  skipAddingFilesFromTsConfig: false,
});

let changedFiles = 0;
let changedDecls = 0;

for (const sourceFile of project.getSourceFiles()) {
  let fileChanged = false;

  for (const decl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (decl.getTypeNode()) {
      continue;
    }

    const initializer = decl.getInitializer();

    if (!initializer) {
      decl.setType('any');
      fileChanged = true;
      changedDecls += 1;
      continue;
    }

    if (initializer.getKind() === SyntaxKind.ArrayLiteralExpression) {
      const arr = initializer;
      if (arr.getText() === '[]') {
        decl.setType('any[]');
        fileChanged = true;
        changedDecls += 1;
        continue;
      }
    }

    if (initializer.getKind() === SyntaxKind.ObjectLiteralExpression) {
      const obj = initializer;
      if (obj.getText() === '{}') {
        decl.setType('Record<string, any>');
        fileChanged = true;
        changedDecls += 1;
      }
    }
  }

  if (fileChanged) {
    changedFiles += 1;
  }
}

project.saveSync();
console.log(`Updated ${changedDecls} variable declaration(s) in ${changedFiles} file(s) for ${tsconfigPath}`);
