declare module 'archiver' {
  export interface ArchiverError extends Error {
    code: string
    data?: unknown
  }

  export interface ArchiverInstance {
    pointer(): number
    pipe(destination: NodeJS.WritableStream): NodeJS.WritableStream
    file(filename: string, data?: { name?: string }): ArchiverInstance
    finalize(): Promise<void>
    on(event: 'warning' | 'error', listener: (error: ArchiverError) => void): ArchiverInstance
    on(event: 'close', listener: () => void): ArchiverInstance
  }

  export default function archiver(
    format: string,
    options?: { zlib?: { level?: number } },
  ): ArchiverInstance
}
