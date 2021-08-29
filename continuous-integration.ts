import * as child_process from 'child_process'

class ContinuousIntegrationSingleton {
  public service = ''
  public build_number: number
  public tag = ''
  public commit_message = ''
  public branch = ''
  public pull_request = false

  constructor() {
    for (const [id, name] of Object.entries({CIRCLECI: 'Circle', TRAVIS: 'Travis' , SEMAPHORE: 'Semaphore', GITHUB_ACTIONS: 'GitHub'})) {
      if (process.env[id] === 'true') this.service = name
    }

    switch (this.service) {
      case 'Circle':
        this.build_number = this.parseInt(process.env.CIRCLE_BUILD_NUM)
        try {
          this.tag = child_process.execSync(`git describe --exact-match ${process.env.CIRCLE_SHA1}`, {stdio: 'pipe' }).toString().trim()
        }
        catch (err) {
          this.tag = null
        }
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${process.env.CIRCLE_SHA1}`).toString().trim()
        this.branch = process.env.CIRCLE_BRANCH
        this.pull_request = !!process.env.CIRCLE_PULL_REQUEST
        break

      case 'GitHub':
        this.build_number = this.parseInt(process.env.GITHUB_RUN_NUMBER)
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${process.env.GITHUB_SHA}`).toString().trim()
        this.pull_request = process.env.GITHUB_EVENT_NAME.startsWith('pull-request')

        if (process.env.GITHUB_HEAD_REF) {
          this.branch = process.env.GITHUB_HEAD_REF.split('/').pop()
        }
        else if (process.env.GITHUB_REF.startsWith('refs/tags/')) {
          // leave branch undefined when tagged... not great
          this.tag = process.env.GITHUB_REF.split('/').pop()
        }
        else if (process.env.GITHUB_REF.startsWith('refs/heads/')) {
          this.branch = process.env.GITHUB_REF.split('/').pop()
        }
        this.branch = this.branch || ''

        break

      default:
        if (process.env.CI === 'true') throw new Error(`Unexpected CI service ${this.service}`)

    }

  }

  private parseInt(n: number | string): number {
    if (typeof n === 'number') return n
    const int = parseInt(n)
    if (isNaN(int)) throw new Error(`${n} is not an integer`)
    return int
  }
}

export const ContinuousIntegration = new ContinuousIntegrationSingleton // eslint-disable-line @typescript-eslint/naming-convention,no-underscore-dangle,id-blacklist,id-match
