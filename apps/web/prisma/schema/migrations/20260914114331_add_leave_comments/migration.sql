-- CreateTable
CREATE TABLE "leave_comments" (
    "id" TEXT NOT NULL,
    "leave_request_id" TEXT NOT NULL,
    "author_id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "leave_comments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "leave_comments_leave_request_id_idx" ON "leave_comments"("leave_request_id");

-- AddForeignKey
ALTER TABLE "leave_comments" ADD CONSTRAINT "leave_comments_leave_request_id_fkey" FOREIGN KEY ("leave_request_id") REFERENCES "leave_requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;
