#!/usr/bin/env node

const { run } = require('../src/cli')
// In bin/insighta.js or src/cli.js
const path = require('path')
const dotenv = require('dotenv')
const cliDir = path.dirname(__dirname)
dotenv.config({ path: path.join(cliDir, '.env') })

run(process.argv.slice(2)).catch((error) => {
  console.error(error.message || 'Unexpected CLI error')
  process.exit(1)
})
