import { type NextRequest, NextResponse } from "next/server"
import { getServerSession } from "next-auth/next"
import { authOptions } from "@/lib/auth"
import clientPromise from "@/lib/mongodb"

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const client = await clientPromise
    const db = client.db("test")

    const user = await db.collection("users").findOne({ email: session.user.email }, { projection: { city: 1 } })

    if (!user || !user.city) {
      return NextResponse.json({ error: "City not set in your profile" }, { status: 400 })
    }

    const messages = await db
      .collection("messages")
      .find({ city: user.city })
      .sort({ createdAt: -1 })
      .limit(50)
      .toArray()

    return NextResponse.json(messages)
  } catch (error) {
    console.error("Error fetching messages:", error)
    return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user?.email) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const { content } = await request.json()

    if (!content) {
      return NextResponse.json({ error: "Content is required" }, { status: 400 })
    }

    const client = await clientPromise
    const db = client.db("test")

    const user = await db
      .collection("users")
      .findOne({ email: session.user.email }, { projection: { name: 1, city: 1 } })

    if (!user || !user.city) {
      return NextResponse.json({ error: "User not found or city not set in profile" }, { status: 400 })
    }

    const newMessage = {
      content,
      city: user.city,
      userId: session.user.id,
      userName: user.name || session.user.name || "Anonymous",
      createdAt: new Date(),
    }

    const result = await db.collection("messages").insertOne(newMessage)

    return NextResponse.json({
      id: result.insertedId,
      ...newMessage,
    })
  } catch (error) {
    console.error("Error creating message:", error)
    return NextResponse.json({ error: "Failed to create message" }, { status: 500 })
  }
}

