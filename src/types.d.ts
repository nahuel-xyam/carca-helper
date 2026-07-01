/** esbuild text loader: .css files are imported as plain strings */
declare module '*.css' {
  const content: string;
  export default content;
}
