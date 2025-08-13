import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
	try {
		// lightweight query
		await prisma.$queryRaw`SELECT 1`
		return NextResponse.json({ ok: true })
	} catch (e: any) {
		return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 500 })
	}
} 