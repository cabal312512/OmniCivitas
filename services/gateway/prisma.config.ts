import { defineConfig } from 'prisma/config';
export default defineConfig({schema:'prisma/schema.prisma',migrations:{path:'prisma/migrations'},datasource:{url:process.env.DATABASE_URL||'postgresql://ocv_demo:ocv-fiction-only-not-real@postgres:5432/civilization'}});
