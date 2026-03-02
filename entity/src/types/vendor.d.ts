declare module 'simple-git' {
  const simpleGit: (...args: any[]) => any;
  export default simpleGit;
}

declare module 'glob' {
  export const sync: (...args: any[]) => any[];
  const glob: (...args: any[]) => any;
  export default glob;
}

declare module 'node-cron' {
  const cron: any;
  export default cron;
}
