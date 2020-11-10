import * as child_process from 'child_process'

class ContinuousIntegrationSingleton {
  public service = ''
  public build_number: string
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
        } catch (err) {
          this.tag = null
        }
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${process.env.CIRCLE_SHA1}`).toString().trim()
        this.branch = process.env.CIRCLE_BRANCH
        this.pull_request = !!process.env.CIRCLE_PULL_REQUEST
        break

      case 'Travis':
        this.build_number = this.parseInt(process.env.TRAVIS_BUILD_NUMBER)
        this.tag = process.env.TRAVIS_TAG
        this.commit_message = process.env.TRAVIS_COMMIT_MESSAGE
        this.branch = (this.tag ? 'master' : process.env.TRAVIS_BRANCH)
        this.pull_request = process.env.TRAVIS_PULL_REQUEST !== 'false'
        break

      case 'GitHub':
        this.build_number = this.parseInt(process.env.GITHUB_RUN_NUMBER)
        this.tag = process.env.GITHUB_REF.startsWith('refs/tags/') ? process.env.GITHUB_REF.split('/').pop() : null
        this.commit_message = child_process.execSync(`git log --format=%B -n 1 ${process.env.GITHUB_SHA}`).toString().trim()
        this.branch = process.env.GITHUB_REF.startsWith('refs/heads/') ? process.env.GITHUB_REF.split('/').pop() : null
        this.pull_request = false // this needs looking into
        break

      case 'Semaphore':
        this.build_number = child_process.execSync('git log -1 --pretty=format:%h').toString().trim()
        this.tag = child_process.execSync('git tag -l --points-at $SEMAPHORE_GIT_SHA').toString().trim()
        this.commit_message = child_process.execSync('git log -1 --pretty=%B').toString().trim()
        this.branch = process.env.SEMAPHORE_GIT_BRANCH
        this.pull_request = false // until semaphore implements pull requests
        break

      default:
        if (process.env.CI === 'true') throw new Error(`Unexpected CI service ${this.service}`)

    }

  }

  private parseInt(n) {
    const int = parseInt(n)
    if (isNaN(int)) throw new Error(`${n} is not an integer`)
    return n
  }
}

export let ContinuousIntegration = new ContinuousIntegrationSingleton // tslint:disable-line:variable-name
