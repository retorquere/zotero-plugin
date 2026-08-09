import * as child_process from 'node:child_process'

class ContinuousIntegrationSingleton {
  public service = ''
  public build_number = 0
  public tag = ''
  public commit_message = ''
  public branch = ''
  public pull_request = false
  public issue = ''

  constructor() {
    for (const [id, name] of Object.entries({ CIRCLECI: 'Circle', TRAVIS: 'Travis', SEMAPHORE: 'Semaphore', GITHUB_ACTIONS: 'GitHub' })) {
      if (process.env[id] === 'true') this.service = name
    }

    switch (this.service) {
      case 'Circle':
        this.build_number = this.parseInt(this.env('CIRCLE_BUILD_NUM'))
        try {
          const sha = this.env('CIRCLE_SHA1')
          this.tag = child_process.execSync(`git describe --exact-match ${sha}`, { stdio: 'pipe' }).toString().trim()
        }
        catch (err) {
          this.tag = ''
        }
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${this.env('CIRCLE_SHA1')}`).toString().trim()
        this.branch = this.env('CIRCLE_BRANCH')
        this.pull_request = !!process.env.CIRCLE_PULL_REQUEST
        break

      case 'GitHub':
        this.build_number = this.parseInt(this.env('GITHUB_RUN_NUMBER'))
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${this.env('GITHUB_SHA')}`).toString().trim()
        this.pull_request = this.env('GITHUB_EVENT_NAME').startsWith('pull-request')

        const githubRef = this.env('GITHUB_REF')

        if (process.env.GITHUB_HEAD_REF) {
          this.branch = process.env.GITHUB_HEAD_REF.split('/').pop() || ''
        }
        else if (githubRef.startsWith('refs/tags/')) {
          // leave branch undefined when tagged... not great
          this.tag = githubRef.split('/').pop() || ''
        }
        else if (githubRef.startsWith('refs/heads/')) {
          this.branch = githubRef.split('/').pop() || ''
        }
        this.branch = this.branch || ''
        this.issue = this.branch.match(/^gh-([0-9]+)$/)?.[1] || ''
        break

      default:
        if (process.env.CI === 'true') throw new Error(`Unexpected CI service ${this.service}`)
    }
  }

  private env(name: string): string {
    const value = process.env[name]
    if (!value) throw new Error(`${name} is not set`)
    return value
  }

  private parseInt(n: number | string | undefined): number {
    if (typeof n === 'undefined') throw new Error('missing integer value')
    if (typeof n === 'number') return n
    const int = parseInt(n)
    if (isNaN(int)) throw new Error(`${n} is not an integer`)
    return int
  }
}

export const ContinuousIntegration = new ContinuousIntegrationSingleton() // eslint-disable-line @typescript-eslint/naming-convention,no-underscore-dangle,id-blacklist,id-match
