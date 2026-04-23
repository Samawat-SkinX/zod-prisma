import { configSchema } from '../config'
import { dotSlash, needsRelatedModel, useModelNames } from '../util'
import { DMMF } from '@prisma/generator-helper'

const defaultConfig = configSchema.parse({})

describe('useModelNames', () => {
	it('appends default suffix Model', () => {
		const { modelName } = useModelNames(defaultConfig)
		expect(modelName('User')).toBe('UserModel')
	})

	it('respects custom modelSuffix', () => {
		const config = configSchema.parse({ modelSuffix: 'Schema' })
		const { modelName } = useModelNames(config)
		expect(modelName('Post')).toBe('PostSchema')
	})

	it('lowercases first char for camelCase', () => {
		const config = configSchema.parse({ modelCase: 'camelCase' })
		const { modelName } = useModelNames(config)
		expect(modelName('User')).toBe('userModel')
	})

	it('relatedModelName prefixes Related when relationModel != default', () => {
		const { relatedModelName } = useModelNames(defaultConfig)
		expect(relatedModelName('User')).toBe('RelatedUserModel')
	})

	it('relatedModelName uses _ prefix when relationModel = default', () => {
		const config = configSchema.parse({ relationModel: 'default' })
		const { relatedModelName } = useModelNames(config)
		expect(relatedModelName('User')).toBe('UserModel')
	})
})

describe('needsRelatedModel', () => {
	const objectField: DMMF.Field = {
		kind: 'object',
		name: 'posts',
		isRequired: false,
		isList: true,
		isUnique: false,
		isId: false,
		isReadOnly: false,
		hasDefaultValue: false,
		type: 'Post',
	} as DMMF.Field

	const scalarField: DMMF.Field = {
		kind: 'scalar',
		name: 'id',
		isRequired: true,
		isList: false,
		isUnique: true,
		isId: true,
		isReadOnly: false,
		hasDefaultValue: false,
		type: 'String',
	} as DMMF.Field

	it('returns true when model has object fields and relationModel is enabled', () => {
		const model = { fields: [scalarField, objectField] } as unknown as DMMF.Model
		expect(needsRelatedModel(model, defaultConfig)).toBe(true)
	})

	it('returns false when relationModel is disabled', () => {
		const config = configSchema.parse({ relationModel: 'false' })
		const model = { fields: [objectField] } as unknown as DMMF.Model
		expect(needsRelatedModel(model, config)).toBe(false)
	})

	it('returns false when model has no object fields', () => {
		const model = { fields: [scalarField] } as unknown as DMMF.Model
		expect(needsRelatedModel(model, defaultConfig)).toBe(false)
	})
})

describe('dotSlash', () => {
	it('prepends ./ for bare paths', () => {
		expect(dotSlash('foo/bar')).toBe('./foo/bar')
	})

	it('leaves ../ paths unchanged', () => {
		expect(dotSlash('../foo')).toBe('../foo')
	})

	it('extracts the module path from node_modules paths', () => {
		expect(dotSlash('/some/path/node_modules/mylib/index')).toBe('mylib/index')
	})
})
