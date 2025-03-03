import * as child_process from 'child_process'

class ContinuousIntegrationSingleton {
  public service = ''
  public build_number: number
  public tag = ''
  public commit_message = ''
  public branch = ''
  public pull_request = false
  public issue = ''

  constructor() {
    if (!process.env.GITHUB_ACTIONS) throw new Error('Only github is supported at this time')
    this.service = 'GitHub'

    this.build_number = this.parseInt(process.env.GITHUB_RUN_NUMBER || '')
    this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${process.env.GITHUB_SHA}`).toString().trim()
    this.pull_request = process.env.GITHUB_EVENT_NAME?.startsWith('pull-request') || false

    if (process.env.GITHUB_HEAD_REF) {
      this.branch = process.env.GITHUB_HEAD_REF.split('/').pop() || ''
    }
    else if (process.env.GITHUB_REF?.startsWith('refs/tags/')) {
      // leave branch undefined when tagged... not great
      this.tag = process.env.GITHUB_REF.split('/').pop() || ''
    }
    else if (process.env.GITHUB_REF?.startsWith('refs/heads/')) {
      this.branch = process.env.GITHUB_REF.split('/').pop() || ''
    }
    this.branch = this.branch || ''
    this.issue = this.branch.match(/^gh-([0-9]+)$/)?.[1] || ''
  }

  private parseInt(n: number | string): number {
    if (typeof n === 'number') return n
    const int = parseInt(n)
    if (isNaN(int)) throw new Error(`${n} is not an integer`)
    return int
  }
}

export const ContinuousIntegration = new ContinuousIntegrationSingleton() // eslint-disable-line @typescript-eslint/naming-convention,no-underscore-dangle,id-blacklist,id-match
