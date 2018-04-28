import {readJsonFile} from './utils';
import {execSync} from 'child_process';
import chalk from 'chalk';
import semver from 'semver';
import {get} from 'lodash';

const DEFAULT_REGISTRY = 'https://registry.npmjs.org/';
const LATEST_TAG = 'latest';
const NEXT_TAG = 'next';
const OLD_TAG = 'old';

function getPackageInfo(name, registry) {
  try {
    return JSON.parse(execSync(`npm show ${name} --registry=${registry} --json`));
  } catch (error) {
    if (error.stderr.toString().includes('npm ERR! code E404')) {
      console.error(chalk.yellow('\nWarning: package not found. Possibly not published yet'));
      return {};
    }
    throw error;
  }
}

function shouldPublishPackage(info, version) {
  const remoteVersionsList = info.versions || [];
  return !remoteVersionsList.includes(version);
}

function getTag(info, version) {
  const isLessThanLatest = () => semver.lt(version, get(info, 'dist-tags.latest'));
  const isPreRelease = () => semver.prerelease(version) !== null;

  if (isLessThanLatest()) {
    return OLD_TAG;
  } else if (isPreRelease()) {
    return NEXT_TAG;
  } else {
    return LATEST_TAG;
  }
}

function execPublish(info, version, flags) {
  const publishCommand = `npm publish --tag=${getTag(info, version)} ${flags}`;
  console.log(chalk.magenta(`Running: "${publishCommand}" for ${info.name}@${version}`));
  execSync(publishCommand);
}

// 1. verify that the package can be published by checking the registry.
//   (Can only publish versions that doesn't already exist)
// 2. choose a tag ->
// * `old` for a release that is less than latest (semver).
// * `next` for a prerelease (beta/alpha/rc).
// * `latest` as default.
// 3. perform npm publish using the chosen tag.
export function publish(flags = '') {
  const pkg = readJsonFile('package.json');
  const registry = get(pkg, 'publishConfig.registry', DEFAULT_REGISTRY);
  const {name, version} = pkg;
  const info = getPackageInfo(name, registry);

  console.log(`Starting the release process for ${chalk.bold(name)}\n`);

  if (!shouldPublishPackage(info, version)) {
    console.log(chalk.blue(`${name}@${version} is already exist on registry ${registry}`));
    console.log('\nNo publish performed');
  } else {
    execPublish(info, version, flags);
    console.log(chalk.green(`\nPublish "${name}@${version}" successfully to ${registry}`));
  }
}
