import { DMMF } from '@prisma/generator-helper'
import { configSchema } from '../config'
import { EnumModel, getZodConstructor } from '../types'

const defaultConfig = configSchema.parse({})
const configEnTh = configSchema.parse({ languages: 'en,th' })

function makeField(overrides: Partial<DMMF.Field>): DMMF.Field {
	return {
		kind: 'scalar',
		name: 'field',
		isRequired: true,
		isList: false,
		isUnique: false,
		isId: false,
		isReadOnly: false,
		hasDefaultValue: false,
		type: 'String',
		...overrides,
	} as DMMF.Field
}

const emptyEnums: EnumModel = {}

describe('getZodConstructor – scalar types', () => {
	const cases: [string, string][] = [
		['String', 'z.string()'],
		['Boolean', 'z.boolean()'],
		['Float', 'z.number()'],
		['Decimal', 'z.number()'],
		['DateTime', 'z.date()'],
		['BigInt', 'z.bigint()'],
		['Bytes', 'z.unknown()'],
	]

	test.each(cases)('%s → %s', (type, expected) => {
		const field = makeField({ type })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe(expected)
	})

	it('Int gets .int() modifier', () => {
		const field = makeField({ type: 'Int' })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe('z.number().int()')
	})
})

describe('getZodConstructor – optional / list', () => {
	it('adds .nullish() for optional non-JSON fields', () => {
		const field = makeField({ type: 'String', isRequired: false })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe('z.string().nullish()')
	})

	it('adds .array() for list fields', () => {
		const field = makeField({ type: 'String', isList: true })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe('z.string().array()')
	})

	it('adds both .array() and .nullish() for optional list', () => {
		const field = makeField({ type: 'String', isList: true, isRequired: false })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe(
			'z.string().array().nullish()'
		)
	})
})

describe('getZodConstructor – enum', () => {
	const enums: EnumModel = {
		Status: { name: 'Status', values: ['ACTIVE', 'INACTIVE'] },
	}

	it('generates z.enum([...]) for enum fields', () => {
		const field = makeField({ kind: 'enum', type: 'Status' })
		expect(getZodConstructor(field, enums, defaultConfig)).toBe(
			"z.enum(['ACTIVE', 'INACTIVE'])"
		)
	})
})

describe('getZodConstructor – JSON / languages', () => {
	it('Json fields use jsonSchema', () => {
		const field = makeField({ type: 'Json', kind: 'scalar' })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe('jsonSchema')
	})

	it('Json fields named *Tr generate multilingual z.object with default language', () => {
		const field = makeField({ name: 'nameTr', type: 'Json', kind: 'scalar' })
		expect(getZodConstructor(field, emptyEnums, defaultConfig)).toBe(
			'z.object({en: z.string()})'
		)
	})

	it('Json *Tr fields reflect all configured languages (en,th)', () => {
		const field = makeField({ name: 'nameTr', type: 'Json', kind: 'scalar' })
		expect(getZodConstructor(field, emptyEnums, configEnTh)).toBe(
			'z.object({en: z.string(), th: z.string()})'
		)
	})

	it('Json *Tr field with genTr=false falls back to jsonSchema', () => {
		const field = makeField({ name: 'nameTr', type: 'Json', kind: 'scalar' })
		expect(getZodConstructor(field, emptyEnums, configEnTh, undefined, false)).toBe(
			'jsonSchema'
		)
	})

	it('Json field not ending in Tr always uses jsonSchema regardless of languages', () => {
		const field = makeField({ name: 'metadata', type: 'Json', kind: 'scalar' })
		expect(getZodConstructor(field, emptyEnums, configEnTh)).toBe('jsonSchema')
	})
})

describe('getZodConstructor – object (relations)', () => {
	it('calls getRelatedModelName for object fields', () => {
		const field = makeField({ kind: 'object', type: 'User' })
		const getRelated = jest.fn((name: string | { toString(): string }) => `${name}Model`)
		getZodConstructor(field, emptyEnums, defaultConfig, getRelated as any)
		expect(getRelated).toHaveBeenCalledWith('User')
	})
})
