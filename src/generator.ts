import { DMMF } from '@prisma/generator-helper'
import path from 'path'
import {
	ImportDeclarationStructure,
	SourceFile,
	StructureKind,
	VariableDeclarationKind,
} from 'ts-morph'
import { Config, PrismaOptions } from './config'
import { getJSDocs } from './docs'
import { setNeedJsonHelper } from './jsonHelper'
import { EnumModel, getZodConstructor } from './types'
import { dotSlash, needsRelatedModel, useModelNames, writeArray } from './util'

export const writeImportsForModel = (
	model: DMMF.Model,
	sourceFile: SourceFile,
	config: Config,
	{ schemaPath, outputPath }: PrismaOptions
) => {
	const { relatedModelName } = useModelNames(config)
	const importList: ImportDeclarationStructure[] = [
		{
			kind: StructureKind.ImportDeclaration,
			namespaceImport: 'z',
			moduleSpecifier: 'zod',
		},
	]

	if (config.imports) {
		importList.push({
			kind: StructureKind.ImportDeclaration,
			namespaceImport: 'imports',
			moduleSpecifier: dotSlash(
				path.relative(outputPath, path.resolve(path.dirname(schemaPath), config.imports))
			),
		})
	}

	if (config.useDecimalJs && model.fields.some((f) => f.type === 'Decimal')) {
		importList.push({
			kind: StructureKind.ImportDeclaration,
			namedImports: ['Decimal'],
			moduleSpecifier: 'decimal.js',
		})
	}

	if (model.fields.some((f) => f.type === 'Json')) {
		importList.push({
			kind: StructureKind.ImportDeclaration,
			namedImports: ['jsonSchema'],
			moduleSpecifier: './utils/json',
		})

		setNeedJsonHelper(true)
	}

	const relationFields = model.fields.filter((f) => f.kind === 'object')

	if (config.relationModel !== false && relationFields.length > 0) {
		const filteredFields = relationFields.filter((f) => f.type !== model.name)

		if (filteredFields.length > 0) {
			importList.push({
				kind: StructureKind.ImportDeclaration,
				moduleSpecifier: './index',
				namedImports: Array.from(
					new Set(
						filteredFields.flatMap((f) => [
							`Complete${f.type}`,
							relatedModelName(f.type),
						])
					)
				),
			})
		}
	}

	sourceFile.addImportDeclarations(importList)
}

export const writeTypeSpecificSchemas = (
	model: DMMF.Model,
	sourceFile: SourceFile,
	config: Config,
	_prismaOptions: PrismaOptions
) => {
	if (config.useDecimalJs && model.fields.some((f) => f.type === 'Decimal')) {
		sourceFile.addStatements((writer) => {
			writer.newLine()
			writeArray(writer, [
				'// Helper schema for Decimal fields',
				'z',
				'.instanceof(Decimal)',
				'.or(z.string())',
				'.or(z.number())',
				'.refine((value) => {',
				'  try {',
				'    return new Decimal(value);',
				'  } catch (error) {',
				'    return false;',
				'  }',
				'})',
				'.transform((value) => new Decimal(value));',
			])
		})
	}
}

export const generateSchemaForModel = (
	model: DMMF.Model,
	enums: EnumModel,
	sourceFile: SourceFile,
	config: Config,
	_prismaOptions: PrismaOptions
) => {
	const { modelName } = useModelNames(config)

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		isExported: true,
		leadingTrivia: (writer) => writer.blankLineIfLastNot(),
		declarations: [
			{
				name: modelName(model.name),
				initializer(writer) {
					writer
						.write('z.object(')
						.inlineBlock(() => {
							model.fields
								.filter((f) => f.kind !== 'object')
								.forEach((field) => {
									writeArray(writer, getJSDocs(field.documentation))
									writer
										.write(
											`${field.name}: ${getZodConstructor(
												field,
												enums,
												config
											)}`
										)
										.write(',')
										.newLine()
								})
						})
						.write(')')
				},
			},
		],
	})

	if (model.fields.some((f) => f.type === 'Json' && f.name.endsWith('Tr'))) {
		sourceFile.addVariableStatement({
			declarationKind: VariableDeclarationKind.Const,
			isExported: true,
			leadingTrivia: (writer) => writer.blankLineIfLastNot(),
			declarations: [
				{
					name: `${modelName(model.name)}Response`,
					initializer(writer) {
						writer
							.write('z.object(')
							.inlineBlock(() => {
								model.fields
									.filter((f) => f.kind !== 'object')
									.forEach((field) => {
										writeArray(writer, getJSDocs(field.documentation))
										writer
											.write(
												`${field.name}: ${getZodConstructor(
													field,
													enums,
													config,
													undefined,
													false
												)}`
											)
											.write(',')
											.newLine()
									})
							})
							.write(')')
					},
				},
			],
		})
	}
}

export const generateRelatedSchemaForModel = (
	model: DMMF.Model,
	enums: EnumModel,
	sourceFile: SourceFile,
	config: Config,
	_prismaOptions: PrismaOptions
) => {
	const { modelName, relatedModelName } = useModelNames(config)

	const relationFields = model.fields.filter((f) => f.kind === 'object')

	sourceFile.addInterface({
		name: `Complete${model.name}`,
		isExported: true,
		extends: [`z.infer<typeof ${modelName(model.name)}>`],
		properties: relationFields.map((f) => ({
			hasQuestionToken: !f.isRequired,
			name: f.name,
			type: `Complete${f.type}${f.isList ? '[]' : ''}${!f.isRequired ? ' | null' : ''}`,
		})),
	})

	sourceFile.addStatements((writer) =>
		writeArray(writer, [
			'',
			'/**',
			` * ${relatedModelName(
				model.name
			)} contains all relations on your model in addition to the scalars`,
			' *',
			' * NOTE: Lazy required in case of potential circular dependencies within schema',
			' */',
		])
	)

	sourceFile.addVariableStatement({
		declarationKind: VariableDeclarationKind.Const,
		isExported: true,
		declarations: [
			{
				name: relatedModelName(model.name),
				type: `z.ZodSchema<Complete${model.name}>`,
				initializer(writer) {
					writer
						.write(`z.lazy(() => ${modelName(model.name)}.extend(`)
						.inlineBlock(() => {
							relationFields.forEach((field) => {
								writeArray(writer, getJSDocs(field.documentation))

								writer
									.write(
										`${field.name}: ${getZodConstructor(
											field,
											enums,
											config,
											relatedModelName
										)}`
									)
									.write(',')
									.newLine()
							})
						})
						.write('))')
				},
			},
		],
	})
}

export const populateModelFile = (
	model: DMMF.Model,
	enums: EnumModel,
	sourceFile: SourceFile,
	config: Config,
	prismaOptions: PrismaOptions
) => {
	writeImportsForModel(model, sourceFile, config, prismaOptions)
	writeTypeSpecificSchemas(model, sourceFile, config, prismaOptions)
	generateSchemaForModel(model, enums, sourceFile, config, prismaOptions)
	if (needsRelatedModel(model, config))
		generateRelatedSchemaForModel(model, enums, sourceFile, config, prismaOptions)
}

export const generateBarrelFile = (models: readonly DMMF.Model[], indexFile: SourceFile) => {
	models.forEach((model) =>
		indexFile.addExportDeclaration({
			moduleSpecifier: `./${model.name.toLowerCase()}`,
		})
	)
}
