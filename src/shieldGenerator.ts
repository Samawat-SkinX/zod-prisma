import { DMMF } from '@prisma/generator-helper'
import { OptionalKind, ImportDeclarationStructure, Project, StructureKind } from 'ts-morph'
import { Config, PrismaOptions } from './config'
import { writeArray } from './util'

export function createShieldFile(
	models: readonly DMMF.Model[],
	project: Project,
	_config: Config,
	{ outputPath, contextPath }: PrismaOptions & { contextPath?: string }
) {
	const sourceFile = project.createSourceFile(`${outputPath}/shield.ts`, {}, { overwrite: true })

	const imports: OptionalKind<ImportDeclarationStructure>[] = [
		{
			kind: StructureKind.ImportDeclaration,
			namedImports: ['allow', 'deny', 'rule', 'shield'],
			moduleSpecifier: 'graphql-shield',
		},
	]

	if (contextPath) {
		imports.push({
			kind: StructureKind.ImportDeclaration,
			isTypeOnly: true,
			namedImports: ['Context'],
			moduleSpecifier: contextPath,
		})
	}

	sourceFile.addImportDeclarations(imports)

	const ctxType = contextPath ? 'Context' : 'any'

	sourceFile.addStatements((writer) => {
		writer.newLine()
		writeArray(writer, [
			`const isAuthenticated = rule({ cache: 'contextual' })(`,
			`  async (_parent: unknown, _args: unknown, ctx: ${ctxType}) => {`,
			`    return ctx?.user != null`,
			`  }`,
			`)`,
		])
	})

	sourceFile.addStatements((writer) => {
		writer.newLine()
		writer.writeLine('export const permissions = shield({')
		writer.writeLine('  Query: {')
		writer.writeLine("    '*': allow,")
		writer.writeLine('  },')
		writer.writeLine('  Mutation: {')
		writer.writeLine("    '*': isAuthenticated,")
		writer.writeLine('  },')
		models.forEach((model) => {
			writer.writeLine(`  ${model.name}: {`)
			writer.writeLine("    '*': allow,")
			writer.writeLine('  },')
		})
		writer.writeLine('})')
	})
}
