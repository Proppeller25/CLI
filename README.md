# Insighta CLI

A command-line interface for interacting with the Insighta Labs API. Manage authentication and profiles directly from your terminal.

## Installation

### Prerequisites

- Node.js 18 or higher
- npm or yarn

### Quick Start

```bash
# Clone the repository
git clone <repository-url>
cd CLI

# Install dependencies
npm install

# Link for local development
npm link

# Test the CLI
insighta login
```

## Configuration

### Environment Variables

Create a `.env` file in the project root:

```bash
# API URL - use local server equivalent to your backend for development
API_URL=https://ebebo-stage3.vercel.app/api

# GitHub OAuth credentials (get from GitHub OAuth App settings)
GITHUB_CLIENT_ID=your_client_id
GITHUB_CLIENT_SECRET=your_client_secret
```

### Switching Environments

```bash
# Production (default)
API_URL=https://ebebo-stage3.vercel.app/api

# Local development
API_URL=http://localhost:3000/api
```

## Usage

### Authentication

#### Login with GitHub OAuth

```bash
insighta login
```

This opens your browser for GitHub authentication. After successful authentication, your credentials are stored locally.

#### Login with Personal Access Token (PAT)

```bash
insighta login --pat your_github_pat_token
```

#### Check Login Status

```bash
insighta whoami
```

Output:
```
Logged in as: user@example.com
User ID: abc123
Logged in at: 2024-01-15T10:30:00.000Z
Role: admin
```

#### Logout

```bash
insighta logout
```

#### Refresh Token

```bash
insighta refresh
```

### Profiles

#### List Profiles

```bash
insighta profiles list
insighta profiles list --page 2
insighta profiles list --limit 20
insighta profiles list --sort-by created_at --order desc
```

Options:
- `--page <number>` - Page number (default: 1)
- `--limit <number>` - Items per page (default: 10)
- `--sort-by <field>` - Sort by field (e.g., created_at, name)
- `--order <asc|desc>` - Sort order

#### Get Single Profile

```bash
insighta profiles get <profile-id>
```

#### Search Profiles

```bash
insighta profiles search --q "search query"
```

#### Create Profile

```bash
insighta profiles create --name "John Doe"
```

#### Export Profiles

```bash
insighta profiles export --q "query" --output profiles.csv
```

## Command Reference

| Command | Description |
|---------|-------------|
| `insighta login` | Login with GitHub OAuth |
| `insighta login --pat <token>` | Login with GitHub PAT |
| `insighta logout` | Logout and clear credentials |
| `insighta whoami` | Show current user info |
| `insighta refresh` | Refresh access token |
| `insighta profiles list` | List all profiles |
| `insighta profiles get <id>` | Get profile by ID |
| `insighta profiles search --q <query>` | Search profiles |
| `insighta profiles create --name <name>` | Create new profile |
| `insighta profiles export --q <query> --output <file>` | Export profiles to CSV |

## Troubleshooting

### "fetch failed" Error

This usually means the API URL is incorrect. Check your `.env` file:

```bash
# Make sure API_URL is set correctly
API_URL=https://ebebo-stage3.vercel.app/api
```

### "Not logged in" Error

Run `insighta login` first to authenticate.

### Port Already in Use

The OAuth callback server uses port 3002. If you get an error, make sure no other application is using that port.

## Development

### Project Structure

```
CLI/
├── bin/
│   └── insighta.js       # CLI entry point
├── src/
│   ├── cli.js            # Main CLI logic
│   ├── commands/
│   │   ├── auth.js       # Authentication commands
│   │   └── profiles.js   # Profile management commands
│   └── utils/
│       ├── api.js        # API request helper
│       └── storage.js    # Credential storage
├── .env                  # Environment variables
└── package.json
```

### Running in Development

```bash
# Using npm link (recommended)
npm link
insighta login

# Or using node directly
node bin/insighta.js login
```

## License

MIT