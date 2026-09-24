# Investment Tracker — MongoDB Version

A simple Node.js + Express + MongoDB/Mongoose application for managing the investment schemes.

## Features
- Login protection
- Investor search/add/edit/delete
- Monthly payment ledger
- Cash / UPI payment method
- Automatic scheme calculations
- Dashboard
- Excel export
- MongoDB Atlas database

## Run locally

1. Install Node.js 20+.
2. Create a MongoDB Atlas cluster and database.
3. Set environment variables:

Linux/macOS:
```bash
export MONGODB_URI='mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/investment_tracker?retryWrites=true&w=majority'
export ADMIN_USER='your_admin'
export ADMIN_PASSWORD='your_strong_password'
export SESSION_SECRET='a-long-random-secret'
export NODE_ENV='production'
```

Windows PowerShell:
```powershell
$env:MONGODB_URI="mongodb+srv://USERNAME:PASSWORD@YOUR-CLUSTER.mongodb.net/investment_tracker?retryWrites=true&w=majority"
$env:ADMIN_USER="your_admin"
$env:ADMIN_PASSWORD="your_strong_password"
$env:SESSION_SECRET="a-long-random-secret"
$env:NODE_ENV="production"
```

4. Install dependencies:
```bash
npm install
```

5. Start:
```bash
npm start
```

6. Open `http://localhost:3000`.

## MongoDB collections

The app creates:
- `investors`
- `payments`

Payments are separate documents, linked to an investor by `investorId`.

## AWS EC2 deployment

On Ubuntu:
```bash
sudo apt update
sudo apt install -y nodejs npm
cd /path/to/investment-tracker-web
npm install
export MONGODB_URI='YOUR_ATLAS_URI'
export ADMIN_USER='your_admin'
export ADMIN_PASSWORD='YOUR_STRONG_PASSWORD'
export SESSION_SECRET='YOUR_LONG_RANDOM_SECRET'
export NODE_ENV='production'
npm start
```

For a persistent process:
```bash
sudo npm install -g pm2
pm2 start server.js --name investment-tracker
pm2 save
pm2 startup
```

Then put Nginx in front of Node and enable HTTPS.

## Important security notes

- Do not commit `.env` or passwords to GitHub.
- Use a strong MongoDB Atlas database password.
- Restrict MongoDB Atlas Network Access to your EC2 server where practical. During development, you can temporarily allow your current IP.
- Keep regular MongoDB backups.
- The Excel file is an export/report, not the primary database.
