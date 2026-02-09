/**
 * Multi-Tenant Schema Verification Script
 * Validates that the Prisma schema is properly configured for multi-tenancy
 */

import * as fs from 'fs';
import * as path from 'path';

interface SchemaAnalysis {
  valid: boolean;
  models: ModelAnalysis[];
  issues: string[];
  warnings: string[];
  summary: {
    totalModels: number;
    tenantScopedModels: number;
    missingTenantId: string[];
    missingIndexes: string[];
    missingCascades: string[];
  };
}

interface ModelAnalysis {
  name: string;
  hasTenantId: boolean;
  hasTenantRelation: boolean;
  hasTenantIndex: boolean;
  hasCascadeDelete: boolean;
  shouldBeScoped: boolean;
}

// Models that should NOT have tenantId (core/system models)
const EXEMPT_MODELS = ['Tenant'];

// Models that might not need tenantId (junction/event models)
const OPTIONAL_TENANT_MODELS = ['WebhookEvent', 'PaymentLink'];

function analyzeSchema(schemaPath: string): SchemaAnalysis {
  const schema = fs.readFileSync(schemaPath, 'utf-8');
  const models: ModelAnalysis[] = [];
  const issues: string[] = [];
  const warnings: string[] = [];

  // Extract all model blocks
  const modelRegex = /model\s+(\w+)\s*{([^}]+)}/g;
  let match;

  while ((match = modelRegex.exec(schema)) !== null) {
    const [, modelName, modelBody] = match;

    // Skip Tenant model itself
    if (EXEMPT_MODELS.includes(modelName)) {
      continue;
    }

    const hasTenantId = /tenantId\s+String/i.test(modelBody);
    const hasTenantRelation =
      /Tenant\s+@relation\(fields:\s*\[tenantId\]/i.test(modelBody);
    const hasCascadeDelete = /@relation\([^)]*onDelete:\s*Cascade[^)]*\)/i.test(
      modelBody,
    );

    // Check for tenantId index (composite or single)
    const hasTenantIndex =
      /@@index\(\[tenantId[,\]]/i.test(modelBody) ||
      /@@unique\(\[tenantId[,\]]/i.test(modelBody);

    const shouldBeScoped = !EXEMPT_MODELS.includes(modelName);
    const isOptional = OPTIONAL_TENANT_MODELS.includes(modelName);

    models.push({
      name: modelName,
      hasTenantId,
      hasTenantRelation,
      hasTenantIndex,
      hasCascadeDelete,
      shouldBeScoped,
    });

    // Validation rules
    if (shouldBeScoped && !hasTenantId && !isOptional) {
      issues.push(`❌ ${modelName}: Missing 'tenantId' field`);
    }

    if (hasTenantId && !hasTenantRelation) {
      issues.push(`❌ ${modelName}: Has tenantId but no Tenant relation`);
    }

    if (hasTenantId && !hasTenantIndex) {
      warnings.push(
        `⚠️  ${modelName}: Missing index on tenantId (performance issue)`,
      );
    }

    if (hasTenantRelation && !hasCascadeDelete) {
      warnings.push(
        `⚠️  ${modelName}: Tenant relation missing 'onDelete: Cascade'`,
      );
    }
  }

  const missingTenantId = models
    .filter(
      (m) =>
        m.shouldBeScoped &&
        !m.hasTenantId &&
        !OPTIONAL_TENANT_MODELS.includes(m.name),
    )
    .map((m) => m.name);

  const missingIndexes = models
    .filter((m) => m.hasTenantId && !m.hasTenantIndex)
    .map((m) => m.name);

  const missingCascades = models
    .filter((m) => m.hasTenantRelation && !m.hasCascadeDelete)
    .map((m) => m.name);

  return {
    valid: issues.length === 0,
    models,
    issues,
    warnings,
    summary: {
      totalModels: models.length,
      tenantScopedModels: models.filter((m) => m.hasTenantId).length,
      missingTenantId,
      missingIndexes,
      missingCascades,
    },
  };
}

function printReport(analysis: SchemaAnalysis): void {
  console.log('\n' + '='.repeat(60));
  console.log('🏢  MULTI-TENANT SCHEMA VERIFICATION REPORT');
  console.log('='.repeat(60) + '\n');

  // Summary
  console.log('📊 SUMMARY:');
  console.log(`   Total Models: ${analysis.summary.totalModels}`);
  console.log(
    `   Tenant-Scoped Models: ${analysis.summary.tenantScopedModels}`,
  );
  console.log(`   Status: ${analysis.valid ? '✅ VALID' : '❌ ISSUES FOUND'}`);
  console.log('');

  // Critical Issues
  if (analysis.issues.length > 0) {
    console.log('🚨 CRITICAL ISSUES:\n');
    analysis.issues.forEach((issue) => console.log(`   ${issue}`));
    console.log('');
  }

  // Warnings
  if (analysis.warnings.length > 0) {
    console.log('⚠️  WARNINGS:\n');
    analysis.warnings.forEach((warning) => console.log(`   ${warning}`));
    console.log('');
  }

  // Detailed Model Analysis
  console.log('📋 MODEL ANALYSIS:\n');

  const scopedModels = analysis.models.filter((m) => m.hasTenantId);
  scopedModels.forEach((model) => {
    const status =
      model.hasTenantId &&
      model.hasTenantRelation &&
      model.hasTenantIndex &&
      model.hasCascadeDelete
        ? '✅'
        : '⚠️';

    console.log(`   ${status} ${model.name}`);
    console.log(
      `      - TenantId Field:    ${model.hasTenantId ? '✅' : '❌'}`,
    );
    console.log(
      `      - Tenant Relation:   ${model.hasTenantRelation ? '✅' : '❌'}`,
    );
    console.log(
      `      - TenantId Index:    ${model.hasTenantIndex ? '✅' : '⚠️'}`,
    );
    console.log(
      `      - Cascade Delete:    ${model.hasCascadeDelete ? '✅' : '⚠️'}`,
    );
    console.log('');
  });

  // Best Practices Check
  console.log('✨ MULTI-TENANT BEST PRACTICES:\n');

  const checks = [
    {
      name: 'All models have tenantId',
      pass: analysis.summary.missingTenantId.length === 0,
      details:
        analysis.summary.missingTenantId.length > 0
          ? `Missing in: ${analysis.summary.missingTenantId.join(', ')}`
          : null,
    },
    {
      name: 'All tenantId fields are indexed',
      pass: analysis.summary.missingIndexes.length === 0,
      details:
        analysis.summary.missingIndexes.length > 0
          ? `Missing indexes: ${analysis.summary.missingIndexes.join(', ')}`
          : null,
    },
    {
      name: 'All tenant relations cascade on delete',
      pass: analysis.summary.missingCascades.length === 0,
      details:
        analysis.summary.missingCascades.length > 0
          ? `Missing cascades: ${analysis.summary.missingCascades.join(', ')}`
          : null,
    },
  ];

  checks.forEach((check) => {
    console.log(`   ${check.pass ? '✅' : '❌'} ${check.name}`);
    if (check.details) {
      console.log(`      ${check.details}`);
    }
  });

  console.log('\n' + '='.repeat(60));

  if (analysis.valid && analysis.warnings.length === 0) {
    console.log('✅ Schema is properly configured for multi-tenancy!');
  } else if (analysis.valid) {
    console.log('✅ Schema is valid but has warnings to address.');
  } else {
    console.log('❌ Schema has critical issues that must be fixed.');
  }
  console.log('='.repeat(60) + '\n');
}

// Run the verification
const schemaPath = path.join(__dirname, 'prisma', 'schema.prisma');
const analysis = analyzeSchema(schemaPath);
printReport(analysis);

// Exit with error code if invalid
process.exit(analysis.valid ? 0 : 1);
