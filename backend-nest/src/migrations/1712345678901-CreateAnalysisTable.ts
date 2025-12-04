import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateAnalysisTable1712345678901 implements MigrationInterface {
    name = 'CreateAnalysisTable1712345678901'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE "analysis" (
                "id" SERIAL NOT NULL,
                "userId" integer NOT NULL,
                "githubUrl" character varying NOT NULL,
                "status" character varying NOT NULL DEFAULT 'pending',
                "sbomData" jsonb,
                "licenseReport" jsonb,
                "vulnerabilities" jsonb,
                "errorMessage" text,
                "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
                "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_analysis_id" PRIMARY KEY ("id")
            )
        `);
        
        await queryRunner.query(`
            ALTER TABLE "analysis" 
            ADD CONSTRAINT "FK_analysis_user" 
            FOREIGN KEY ("userId") 
            REFERENCES "user"("id") 
            ON DELETE CASCADE
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "analysis" DROP CONSTRAINT "FK_analysis_user"`);
        await queryRunner.query(`DROP TABLE "analysis"`);
    }
}
