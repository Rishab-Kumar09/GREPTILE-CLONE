import { NextRequest, NextResponse } from 'next/server'
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { randomUUID } from 'crypto'

export const dynamic = 'force-dynamic'

const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-2',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
})

export async function POST(request: NextRequest) {
  try {
    const { filename, contentType } = await request.json()

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif']
    if (!allowedTypes.includes(contentType)) {
      return NextResponse.json({
        success: false,
        error: 'Invalid file type. Only JPG, PNG, and GIF allowed.'
      }, { status: 400 })
    }

    // Generate unique filename
    const fileExtension = filename.split('.').pop()
    const uniqueFilename = `feedback/${randomUUID()}.${fileExtension}`

    // Create presigned URL for upload (expires in 5 minutes)
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET_NAME || 'greptile-feedback-images',
      Key: uniqueFilename,
      ContentType: contentType,
    })

    const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 })

    // Generate public URL
    const bucketName = process.env.S3_BUCKET_NAME || 'greptile-feedback-images'
    const region = process.env.AWS_REGION || 'us-east-2'
    const publicUrl = `https://${bucketName}.s3.${region}.amazonaws.com/${uniqueFilename}`

    return NextResponse.json({
      success: true,
      uploadUrl,
      publicUrl
    })

  } catch (error) {
    console.error('❌ S3 presigned URL generation failed:', error)
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Failed to generate upload URL'
    }, { status: 500 })
  }
}

