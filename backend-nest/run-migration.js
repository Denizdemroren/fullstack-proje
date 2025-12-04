const { DataSource } = require('typeorm');
const path = require('path');

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USER || 'user',
  password: process.env.DB_PASSWORD || 'password',
  database: process.env.DB_NAME || 'mydatabase',
  entities: [path.join(__dirname, 'dist/**/*.entity{.ts,.js}')],
  migrations: [path.join(__dirname, 'src/migrations/*{.ts,.js}')],
  synchronize: false,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

async function runMigrations() {
  try {
    await AppDataSource.initialize();
    console.log('Data Source has been initialized!');
    
    const migrations = await AppDataSource.runMigrations();
    console.log(`Ran ${migrations.length} migrations:`);
    migrations.forEach(migration => {
      console.log(`- ${migration.name}`);
    });
    
    await AppDataSource.destroy();
    console.log('Migration completed successfully!');
  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

runMigrations();
