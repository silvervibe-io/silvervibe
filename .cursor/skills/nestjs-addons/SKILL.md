---
name: nestjs-addons
description: Adds a NestJS product add-on module (Slack, Microsoft Teams, Jira, Linear, GitHub, or a new one) with Swagger decorators and a Jest spec. Use when extending apps/api, OpenAPI, or an integration add-on.
---

# NestJS add-on

Create `apps/api/src/app/addons/<name>/`:

- `<name>.module.ts`
- `<name>.controller.ts`
- `<name>.service.ts`
- `<name>.service.spec.ts`
- DTOs with `@ApiProperty()` for every response field

Controller pattern:

```typescript
@ApiTags('linear')
@Controller('addons/linear')
export class LinearController {
  private readonly linear = inject(LinearService);

  @Get('status')
  @ApiOperation({ summary: 'Linear add-on status' })
  status(): AddonStatusDto {
    return this.linear.status();
  }
}
```

Register the module in `AppModule`. Keep secrets in environment variables, never in source. After the contract changes, run `npx nx openapi api`.
