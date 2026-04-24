import { DMMF } from '@prisma/generator-helper'
import {
	OptionalKind,
	ImportDeclarationStructure,
	Project,
	StructureKind,
	VariableDeclarationKind,
} from 'ts-morph'
import { Config, PrismaOptions } from './config'
import { useModelNames, writeArray } from './util'

export function createMiddlewareFile(
	models: readonly DMMF.Model[],
	project: Project,
	config: Config,
	{ outputPath, contextPath }: PrismaOptions & { contextPath?: string }
) {
	const { modelName } = useModelNames(config)
	const sourceFile = project.createSourceFile(
		`${outputPath}/middleware.ts`,
		{},
		{ overwrite: true }
	)

	const imports: OptionalKind<ImportDeclarationStructure>[] = [
		{
			kind: StructureKind.ImportDeclaration,
			namedImports: models.map((m) => modelName(m.name)),
			moduleSpecifier: './index',
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

	models.forEach((model) => {
		const name = modelName(model.name)

		sourceFile.addStatements((writer) => {
			writer.newLine()
			writeArray(writer, [
				`export function parse${model.name}(data: unknown) {`,
				`  return ${name}.parse(data)`,
				`}`,
			])
			writer.newLine()
			writeArray(writer, [
				`export function safeParse${model.name}(data: unknown) {`,
				`  return ${name}.safeParse(data)`,
				`}`,
			])
		})
	})

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		isExported: true,
		leadingTrivia: (writer) => writer.newLine(),
		declarations: [
			{
				name: 'validators',
				initializer(writer) {
					writer.write('{').newLine()
					models.forEach((model) => {
						writer.writeLine(`  ${model.name}: ${modelName(model.name)},`)
					})
					writer.write('} as const')
				},
			},
		],
	})
}
