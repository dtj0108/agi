import { Project, SyntaxKind } from 'ts-morph';

const [,, tsconfigPath] = process.argv;
if (!tsconfigPath) {
  console.error('Usage: node scripts/ts-migration/add-param-anys.mjs <tsconfigPath>');
  process.exit(1);
}

const project = new Project({
  tsConfigFilePath: tsconfigPath,
  skipAddingFilesFromTsConfig: false,
});

let changedFiles = 0;
let changedParams = 0;

for (const sourceFile of project.getSourceFiles()) {
  let fileChanged = false;

  for (const param of sourceFile.getDescendantsOfKind(SyntaxKind.Parameter)) {
    const nameNode = param.getNameNode();
    const isThisParam = nameNode.getKind() === SyntaxKind.Identifier && nameNode.getText() === 'this';

    if (isThisParam || param.getTypeNode()) {
      continue;
    }

    if (param.isRestParameter()) {
      param.setType('any[]');
    } else {
      param.setType('any');
    }

    fileChanged = true;
    changedParams += 1;
  }

  if (fileChanged) {
    changedFiles += 1;
  }
}

project.saveSync();
console.log(`Updated ${changedParams} parameter(s) in ${changedFiles} file(s) for ${tsconfigPath}`);
