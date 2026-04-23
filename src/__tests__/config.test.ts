import { configSchema } from '../config'

describe('configSchema', () => {
	it('uses safe defaults when config is empty', () => {
		const result = configSchema.safeParse({})
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.relationModel).toBe(true)
		expect(result.data.modelSuffix).toBe('Model')
		expect(result.data.modelCase).toBe('PascalCase')
		expect(result.data.useDecimalJs).toBe(false)
		expect(result.data.prismaJsonNullability).toBe(true)
		expect(result.data.languages).toEqual(['en'])
		expect(result.data.withMiddleware).toBe(false)
		expect(result.data.withShield).toBe(false)
		expect(result.data.contextPath).toBeUndefined()
	})

	it('parses languages as comma-separated string', () => {
		const result = configSchema.safeParse({ languages: 'en,th' })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.languages).toEqual(['en', 'th'])
	})

	it('non-string languages values default to [en] (Prisma config values are always strings)', () => {
		// In a real prisma.schema all config values arrive as strings; arrays are not a valid input
		const result = configSchema.safeParse({ languages: ['en', 'th', 'zh'] })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.languages).toEqual(['en'])
	})

	it('parses withMiddleware as boolean string', () => {
		const result = configSchema.safeParse({ withMiddleware: 'true' })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.withMiddleware).toBe(true)
	})

	it('parses withShield as boolean string', () => {
		const result = configSchema.safeParse({ withShield: 'true' })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.withShield).toBe(true)
	})

	it('accepts contextPath as a module path string', () => {
		const result = configSchema.safeParse({ contextPath: '../../context' })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.contextPath).toBe('../../context')
	})

	it('accepts modelCase camelCase', () => {
		const result = configSchema.safeParse({ modelCase: 'camelCase' })
		expect(result.success).toBe(true)
		if (!result.success) return
		expect(result.data.modelCase).toBe('camelCase')
	})

	it('rejects invalid modelCase', () => {
		const result = configSchema.safeParse({ modelCase: 'snake_case' })
		expect(result.success).toBe(false)
	})
})
