// commands/profiles.js
const Table = require('cli-table3')
const ora = require('ora').default
const fs = require('fs')
const path = require('path')
const { apiRequest } = require('../utils/api')
const { getAuth } = require('../utils/storage')

async function handleProfilesCommand(subcommand, args) {
  switch (subcommand) {
    case 'list':
      await handleList(args)
      break
    case 'get':
      await handleGet(args)
      break
    case 'search':
      await handleSearch(args)
      break
    case 'create':
      await handleCreate(args)
      break
    case 'export':
      await handleExport(args)
      break
    default:
      console.log(`Unknown profiles command: ${subcommand}`)
      printProfilesHelp()
  }
}

async function handleList(args) {
  const params = new URLSearchParams()
  let sortBy = null, order = null
  for (let i = 0; i < args.length; i++) {
    const key = args[i]
    const value = args[i+1]
    if (key.startsWith('--')) {
      const paramKey = key.slice(2)
      if (paramKey === 'sort-by') {
        sortBy = value
        i++
      } else if (paramKey === 'order') {
        order = value
        i++
      } else {
        params.append(paramKey, value)
        i++
      }
    }
  }
  if (sortBy) params.append('sort_by', sortBy)
  if (order) params.append('order', order)
  if (!params.has('page')) params.append('page', '1')
  if (!params.has('limit')) params.append('limit', '10')

  const spinner = ora('Fetching profiles...').start()
  try {
    const response = await apiRequest(`/profiles?${params.toString()}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message || 'Failed to fetch profiles')
    }
    const data = await response.json()
    spinner.succeed(`Found ${data.total} profiles (page ${data.page} of ${data.total_pages})`)

    if (data.data.length === 0) {
      console.log('No profiles match the criteria.')
      return
    }

    // Display as table
    const table = new Table({
      head: ['ID', 'Name', 'Gender', 'Age', 'Age Group', 'Country'],
      colWidths: [36, 25, 8, 6, 12, 12]
    })
    for (const p of data.data) {
      table.push([
        p.id.slice(0, 8) + '…',
        p.name,
        p.gender,
        p.age,
        p.age_group,
        p.country_id
      ])
    }
    console.log(table.toString())
    console.log(`\nMore pages: use --page ${data.page + 1} or --page ${data.page - 1} (prev)`)
  } catch (err) {
    spinner.fail(err.message)
  }
}

async function handleGet(args) {
  const id = args[0]
  if (!id) {
    console.error('Usage: insighta profiles get <id>')
    return
  }
  const spinner = ora('Fetching profile...').start()
  try {
    const response = await apiRequest(`/profiles/${id}`)
    if (!response.ok) {
      if (response.status === 404) throw new Error('Profile not found')
      const error = await response.json()
      throw new Error(error.message)
    }
    const data = await response.json()
    spinner.succeed('Profile found:')
    console.log(JSON.stringify(data, null, 2))
  } catch (err) {
    spinner.fail(err.message)
  }
}

async function handleSearch(args) {
  let query = ''
  let page = 1, limit = 10
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--page') page = parseInt(args[++i])
    else if (args[i] === '--limit') limit = parseInt(args[++i])
    else query += args[i] + ' '
  }
  if (!query) {
    console.error('Usage: insighta profiles search  ["your natural language query"] [--page 1] [--limit 10]')
    return
  }
  const params = new URLSearchParams({ q: query, page, limit })
  const spinner = ora('Searching profiles...').start()
  try {
    const response = await apiRequest(`/profiles/search?${params.toString()}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }
    const data = await response.json()
    spinner.succeed(`Found ${data.total} profiles (page ${data.page} of ${data.total_pages})`)
    if (data.data.length === 0) {
      console.log('No results.')
      return
    }
    const table = new Table({
      head: ['ID', 'Name', 'Gender', 'Age', 'Age Group', 'Country'],
      colWidths: [36, 25, 8, 6, 12, 12]
    })
    for (const p of data.data) {
      table.push([p.id.slice(0,8)+'…', p.name, p.gender, p.age, p.age_group, p.country_id])
    }
    console.log(table.toString())
  } catch (err) {
    spinner.fail(err.message)
  }
}

async function handleCreate(args) {
  const auth = getAuth()
  if (auth?.user?.role !== 'admin') {
    console.error('Only admin users can create profiles.')
    return
  }
  let name = null
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--name') name = args[++i]
  }
  if (!name) {
    console.error('Usage: insighta profiles create --name "Full Name"')
    return
  }
  const spinner = ora('Creating profile...').start()
  try {
    const response = await apiRequest('/profiles', {
      method: 'POST',
      body: JSON.stringify({ name })
    })
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }
    const data = await response.json()
    spinner.succeed(`Profile created: ${data.data.name} (${data.data.id})`)
  } catch (err) {
    spinner.fail(err.message)
  }
}

async function handleExport(args) {
  let format = 'csv'
  let output = null
  const params = new URLSearchParams()

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--format') {
      format = args[++i]
    } else if (args[i] === '--output') {
      output = args[++i]
    } else if (args[i].startsWith('--')) {
      let paramKey = args[i].slice(2)
      const value = args[++i]
      if (paramKey === 'country') paramKey = 'country_id'
      params.append(paramKey, value)
    }
  }

  params.set('format', format)

  if (!output) {
    output = path.join(process.cwd(), `profiles_${Date.now()}.csv`)
  }

  const spinner = ora('Exporting profiles...').start()
  try {
    const response = await apiRequest(`/profiles/export?${params.toString()}`)
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.message)
    }
    const buffer = await response.text()
    fs.writeFileSync(output, buffer)
    spinner.succeed(`Exported to ${output}`)
  } catch (err) {
    spinner.fail(err.message)
  }
}

function printProfilesHelp() {
  console.log(`
Profile commands:
  insighta profiles list [--gender m|f] [--age_group X] [--country_id XX] [--min_age N] [--max_age N] [--sort_by age|created_at|gender_probability] [--order asc|desc] [--page N] [--limit N]
  insighta profiles get <id>
  insighta profiles search --q "natural language" [--page N] [--limit N]
  insighta profiles create --name "Full Name"  (admin only)
  insighta profiles export --q "natural language" [--format csv] [--output filename.csv]
  `)
}

module.exports = { handleProfilesCommand }