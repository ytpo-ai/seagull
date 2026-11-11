import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Project, ProjectSchema } from '../../shared/schemas/project.schema';
import { ProjectApiKey, ProjectApiKeySchema } from '../../shared/schemas/project-api-key.schema';
import { Employee, EmployeeSchema } from '../../shared/schemas/employee.schema';
import { ProjectsService } from './projects.service';
import { ProjectsController } from './projects.controller';
import { AgentClientModule } from '../agents-client/agent-client.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Project.name, schema: ProjectSchema },
      { name: ProjectApiKey.name, schema: ProjectApiKeySchema },
      { name: Employee.name, schema: EmployeeSchema },
    ]),
    AgentClientModule,
  ],
  controllers: [ProjectsController],
  providers: [ProjectsService],
  exports: [ProjectsService],
})
export class ProjectsModule {}