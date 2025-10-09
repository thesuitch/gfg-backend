# GFG Stable Backend

A Node.js/Express backend API for the GFG Stable fractional racehorse ownership platform.

## Features

- **Authentication System**: JWT-based auth with role-based access control
- **User Management**: Registration, login, logout, and user administration
- **Role-Based Access**: Admin, Member, Finance, and Manager roles
- **PostgreSQL Database**: Robust data persistence with migrations
- **Security**: Password hashing, rate limiting, CORS, and helmet
- **TypeScript**: Full type safety and modern development experience

## Tech Stack

- **Runtime**: Node.js with Express
- **Language**: TypeScript
- **Database**: PostgreSQL 15
- **Authentication**: JWT + bcrypt
- **Validation**: express-validator
- **Security**: helmet, cors, rate limiting

## Quick Start

### Prerequisites

- Node.js 18+ 
- PostgreSQL 15+
- npm or yarn

### Installation

1. **Install PostgreSQL 15+** from: https://www.postgresql.org/download/windows/
   - Remember to add PostgreSQL to your PATH during installation

2. **Clone and install dependencies:**
   ```bash
   cd backend
   npm install
   ```

3. **Set up PostgreSQL database:**
   ```bash
   npm run setup
   ```
   - Follow the prompts to create your database
   - The script will automatically create your `.env` file

4. **Run database migrations:**
   ```bash
   npm run migrate
   ```

5. **Seed the database:**
   ```bash
   npm run seed
   ```

6. **Start development server:**
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3001`

## Database Setup

### PostgreSQL Installation

1. **Install PostgreSQL 15+** from: https://www.postgresql.org/download/windows/
2. **Run the setup script:**
   ```bash
   npm run setup
   ```
3. **Follow the prompts** to create your database and user
4. **The script will automatically create your `.env` file**

### Manual Setup (Alternative)

If you prefer to set up manually:
1. Install PostgreSQL 15+
2. Create database: `gfg_stable`
3. Create user: `gfg_user` with password: `gfg_password`
4. Update `.env` file with your connection details

## API Endpoints

### Authentication

- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `POST /api/auth/logout` - User logout
- `GET /api/auth/me` - Get current user

### Admin Only

- `GET /api/auth/users` - List all users
- `PUT /api/auth/users/:id/role` - Update user role
- `DELETE /api/auth/users/:id` - Deactivate user

### Health Check

- `GET /health` - API health status

## Database Migrations

### Run Migrations

```bash
npm run migrate
```

### Create New Migration

```bash
npm run migrate:create <migration-name>
```

Example:
```bash
npm run migrate:create add_horses_table
```

### Migration Files

Migrations are stored in `src/database/migrations/` and run in alphabetical order.

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm start` - Start production server
- `npm run migrate` - Run database migrations
- `npm run migrate:create` - Create new migration file

### Project Structure

```
src/
├── database/          # Database connection and migrations
├── middleware/        # Express middleware
├── routes/           # API route handlers
├── services/         # Business logic
├── types/            # TypeScript type definitions
├── utils/            # Utility functions
└── index.ts          # Main application entry point
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DB_HOST` | PostgreSQL host | `localhost` |
| `DB_PORT` | PostgreSQL port | `5432` |
| `DB_NAME` | Database name | `gfg_stable` |
| `DB_USER` | Database user | `gfg_user` |
| `DB_PASSWORD` | Database password | `gfg_password` |
| `JWT_SECRET` | JWT signing secret | `your-super-secret-jwt-key-change-in-production` |
| `JWT_EXPIRES_IN` | JWT expiration time | `24h` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |

## Security Features

- **Password Hashing**: bcrypt with 12 salt rounds
- **JWT Tokens**: Secure token-based authentication
- **Rate Limiting**: Configurable request rate limiting
- **CORS**: Cross-origin resource sharing protection
- **Helmet**: Security headers middleware
- **Input Validation**: Request data validation with express-validator
- **SQL Injection Protection**: Parameterized queries with pg

## Role System

- **Admin**: Full system access and user management
- **Member**: Standard member access to horses and ownership
- **Finance**: Financial operations and reporting access
- **Manager**: Horse and stable management access

## Testing

```bash
# Run tests (when implemented)
npm test

# Run tests with coverage
npm run test:coverage
```

## Production Deployment

1. **Build the application:**
   ```bash
   npm run build
   ```

2. **Set production environment variables:**
   - Update `.env` with production values
   - Set `NODE_ENV=production`
   - Use strong `JWT_SECRET`

3. **Start production server:**
   ```bash
   npm start
   ```

## Contributing

1. Follow TypeScript best practices
2. Use meaningful commit messages
3. Test your changes thoroughly
4. Update documentation as needed

## License

MIT License - see LICENSE file for details
