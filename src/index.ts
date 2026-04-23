// @ts-ignore Importing package.json for automated synchronization of version numbers
import { version } from '../package.json'

import { generatorHandler } from '@prisma/generator-helper'
import { Project } from 'ts-morph'
import { SemicolonPreference } from 'typescript'
import { configSchema, PrismaOptions } from './config'
import { generateBarrelFile, populateModelFile } from './generator'
import { createJsonHelperFile } from './jsonHelper'
import { createMiddlewareFile } from './middlewareGenerator'
import { createShieldFile } from './shieldGenerator'
import { EnumModel } from './types'

generatorHandler({
	onManifest() {
		return {
			version,
			prettyName: 'Zod Schemas',
			defaultOutput: 'zod',
		}
	},
	onGenerate(options) {
		const project = new Project()

		const models = options.dmmf.datamodel.models
		const enums: EnumModel =
			options.dmmf.schema.enumTypes.model?.reduce<EnumModel>((prev, enumModel) => {
				return { ...prev, [enumModel.name]: enumModel }
			}, {}) ?? {}

		const { schemaPath } = options
		const outputPath = options.generator.output!.value!
		const clientPath = options.otherGenerators.find(
			(each) => each.provider.value === 'prisma-client-js'
		)!.output!.value!

		const results = configSchema.safeParse(options.generator.config)
		if (!results.success)
			throw new Error(
				'Incorrect config provided. Please check the values you provided and try again.'
			)

		const config = results.data
		const prismaOptions: PrismaOptions = {
			clientPath,
			outputPath,
			schemaPath,
		}

		const indexFile = project.createSourceFile(
			`${outputPath}/index.ts`,
			{},
			{ overwrite: true }
		)

		generateBarrelFile(models, indexFile)

		indexFile.formatText({
			indentSize: 2,
			convertTabsToSpaces: true,
			semicolons: SemicolonPreference.Remove,
		})

		models.forEach((model) => {
			const sourceFile = project.createSourceFile(
				`${outputPath}/${model.name.toLowerCase()}.ts`,
				{},
				{ overwrite: true }
			)

			populateModelFile(model, enums, sourceFile, config, prismaOptions)

			sourceFile.formatText({
				indentSize: 2,
				convertTabsToSpaces: true,
				semicolons: SemicolonPreference.Remove,
			})
		})

		createJsonHelperFile(project, outputPath, indexFile)

		if (config.withMiddleware) {
			createMiddlewareFile(models, project, config, {
				...prismaOptions,
				contextPath: config.contextPath,
			})
		}

		if (config.withShield) {
			createShieldFile(models, project, config, {
				...prismaOptions,
				contextPath: config.contextPath,
			})
		}

		return project.save()
	},
})
