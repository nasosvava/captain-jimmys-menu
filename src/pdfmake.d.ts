declare module 'pdfmake/build/pdfmake.js' {
  const pdfMake: {
    addVirtualFileSystem: (vfs: Record<string, string>) => void
    addFonts: (fonts: Record<string, Record<string, string>>) => void
    createPdf: (documentDefinition: unknown) => { download: (filename?: string) => void }
  }
  export default pdfMake
}

declare module 'pdfmake/build/vfs_fonts.js' {
  const vfs: Record<string, string>
  export default vfs
}
