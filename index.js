#!/usr/bin/env node

// TODO: parse markdown links in notes

const clc = require('cli-color');
const omelette = require('omelette');
const wrap = require('wordwrap')(80);
const data = require('caniuse-db/fulldata-json/data-2.0.json');

const agents = ['ie', 'edge', 'firefox', 'chrome', 'safari', 'opera', 'ios_saf', 'op_mini', 'android', 'and_chr'];
const defaultItemWidth = 6;
const eras = [-3, -2, -1, 0, 1, 2, 3];

/**
 * getAgentVersion() returns agent version at specified era
 */
const getAgentVersion = function getAgentVersion(agent, era) {
  try {
    return data.agents[agent]
      .version_list.find(item => item.era === era).version;
  } catch (error) {
    return undefined;
  }
};

/**
 * columnWidths contains max column width for each agent
 */
const columnWidths = agents.reduce((collection, agent) => {
  const agentAbbr = data.agents[agent].abbr;
  const agentHeaderWidth = agentAbbr.length > defaultItemWidth
    ? agentAbbr.length : defaultItemWidth;

  // calculate max required width for agent
  const maxWidth = eras.reduce((max, era) => {
    try {
      const width = getAgentVersion(agent, era).length;
      return width > max ? width : max;
    } catch (error) {
      return max;
    }
  });

  return {
    ...collection,
    [agent]: maxWidth > agentHeaderWidth ? maxWidth : agentHeaderWidth,
  };
}, {});

/**
 * strRepeat() returns string str repeater qty times
 */
const strRepeat = function strRepeat(str, qty) {
  let result = '';
  for (let i = 0; i < qty; i += 1) {
    result += str;
  }
  return result;
};

/**
 * padCenter() returns fixed length string,
 * padding with padStr from both sides if necessary
 */
const padCenter = function padCenter(str, length, padStr) {
  const padLen = length - str.length;

  return strRepeat(padStr, Math.ceil(padLen / 2))
    + str
    + strRepeat(padStr, Math.floor(padLen / 2));
};

/**
 * printTableHeader() prints `caniuse` table header
 */
const printTableHeader = function printTableHeader() {
  agents.forEach((agent) => {
    const col = clc.black.bgWhite(padCenter(data.agents[agent].abbr, columnWidths[agent], ' '));
    process.stdout.write(col);
    process.stdout.write(' ');
  });

  process.stdout.write('\n');
};

/**
 * printTableRowItem prints `caniuse` table row column
 */
const printTableRowItem = function printTableRowItem(agent, version, dataItem) {
  const text = padCenter(version, columnWidths[agent], ' ');

  if (dataItem[0] === 'y') {
    process.stdout.write(clc.white.bgGreen(text));
  } else if (dataItem[0] === 'p') {
    process.stdout.write(clc.white.bgYellow(text));
  } else {
    process.stdout.write(clc.white.bgRed(text));
  }
};

/**
 *  printTableRow prints `caniuse` trable row
 */
const printTableRow = function printTableRow(item, era) {
  agents.forEach((agent, index) => {
    const version = getAgentVersion(agent, era);

    if (version !== undefined) {
      const dataItem = item.stats[agent][version];
      printTableRowItem(agent, version, dataItem);
    } else {
      // space between items
      process.stdout.write(padCenter('', 6, ' '));
    }

    if (index < agents.length - 1) {
      if (era === 0) {
        process.stdout.write(clc.bgBlackBright(' '));
      } else {
        process.stdout.write(' ');
      }
    }
  });

  process.stdout.write('\n');
};

/**
 * printItem() prints `caniuse` results for specified item
 */
const printItem = function printItem(item) {
  console.log(clc.underline(wrap(`${item.title}`)));
  console.log(`https://caniuse.com/#feat=${item.key}`);
  console.log();
  console.log(wrap(item.description));
  console.log();
  printTableHeader();
  eras.forEach(era => printTableRow(item, era));
  if (item.notes) {
    console.log();
    console.log(wrap(`Notes: ${item.notes}`));
  }
};

/**
 * findResult() returns `caniuse` item matching given name
 */
const findResult = function findResult(name) {
  const items = data.data;

  // return directly matching item
  if (items.name !== undefined) {
    return items[name];
  }

  // find items matching by keyword or firefox_id
  const otherResults = Object.keys(data.data).filter((key) => {
    // tokenize keywords, filter white space
    const keywords = data.data[key].keywords
      .split(',')
      .map(item => item.trim())
      .filter(item => item.length > 0);

    return data.data[key].firefox_id === name ||
      keywords.indexOf(name) >= 0;
  });

  // return array of matches
  if (otherResults.length > 0) {
    return otherResults.reduce((list, key) => list.concat(data.data[key]), []);
  }

  return undefined;
};

/**
 * omelette tab completion results for first argument
 */
const firstArgument = ({ reply }) => {
  // add all keys
  const dataKeys = Object.keys(data.data);

  // add keywords and firefox_id's
  const otherKeys = Object.keys(data.data).reduce((keys, item) => {
    const newKeys = [];
    const { firefox_id, keywords } = data.data[item];

    if (firefox_id.length > 0) {
      newKeys.push(firefox_id);
    }

    keywords.split(',').forEach((key) => {
      if (key.trim().length > 0) {
        newKeys.push(key.trim());
      }
    });

    return [].concat(keys, newKeys);
  });

  reply([].concat(dataKeys, otherKeys));
};

// initialize omelette tab completion
omelette`caniuse ${firstArgument}`.init();

// inject key for each item in data object
Object.keys(data.data).forEach((key) => {
  data.data[key].key = key;
});

// find and display result
const name = process.argv[2];
const res = findResult(name);

if (res !== undefined) {
  if (Array.isArray(res)) {
    res.forEach(item => printItem(item));
  } else {
    printItem(res);
  }
} else {
  console.log('Nothing was found');
}
