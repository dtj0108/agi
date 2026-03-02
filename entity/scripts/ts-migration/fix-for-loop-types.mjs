import { Project, SyntaxKind } from 'ts-morph';

const [,, tsconfigPath] = process.argv;
if (!tsconfigPath) {
  console.error('Usage: node scripts/ts-migration/fix-for-loop-types.mjs <tsconfigPath>');
  process.exit(1);
}

const project = new Project({ tsConfigFilePath: tsconfigPath, skipAddingFilesFromTsConfig: false });

let changedFiles = 0;
let changedDecls = 0;

for (const sourceFile of project.getSourceFiles()) {
  let fileChanged = false;
  for (const decl of sourceFile.getDescendantsOfKind(SyntaxKind.VariableDeclaration)) {
    if (!decl.getTypeNode()) continue;
    const varDeclList = decl.getFirstAncestorByKind(SyntaxKind.VariableDeclarationList);
    if (!varDeclList) continue;
    const parent = varDeclList.getParent();
    if (!parent) continue;

    if (parent.getKind() === SyntaxKind.ForOfStatement || parent.getKind() === SyntaxKind.ForInStatement) {
      decl.removeType();
      fileChanged = true;
      changedDecls += 1;
    }
  }
  if (fileChanged) changedFiles += 1;
}

project.saveSync();
console.log(`Removed ${changedDecls} for-loop variable annotation(s) in ${changedFiles} file(s) for ${tsconfigPath}`);
