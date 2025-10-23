import fs from 'fs'
import path from 'path'

const folders = process.cwd().split(path.sep)
const rootIndex = folders.findIndex((folder: string, i: number) => fs.existsSync(path.join(folders.slice(0, i + 1).join(path.sep), 'package.json')))
export const root = (rootIndex > 0 ? folders.slice(0, rootIndex + 1) : folders).join(path.sep)
console.log('project directory:', root)

export const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf-8'))
