-- DropForeignKey
ALTER TABLE `mailgunemail` DROP FOREIGN KEY `MailgunEmail_clientId_fkey`;

-- DropForeignKey
ALTER TABLE `mailgunemailattachment` DROP FOREIGN KEY `MailgunEmailAttachment_mailgunEmailId_fkey`;

-- AlterTable
ALTER TABLE `company` ADD COLUMN `google_calendar_token` VARCHAR(191) NULL;

-- CreateTable
CREATE TABLE `ClientConversationTrack` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `client_id` INTEGER NOT NULL,
    `email_is_read` BOOLEAN NOT NULL DEFAULT true,
    `sms_is_read` BOOLEAN NOT NULL DEFAULT true,
    `email_is_unread_count` INTEGER NOT NULL DEFAULT 0,
    `sms_unread_count` INTEGER NOT NULL DEFAULT 0,
    `email_last_message` VARCHAR(191) NOT NULL DEFAULT 'no message',
    `sms_last_message` VARCHAR(191) NOT NULL DEFAULT 'no message',
    `send_at` DATETIME(3) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `ClientConversationTrack_client_id_key`(`client_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ClientSmsAttachments` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `url` VARCHAR(191) NOT NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `client_sms_id` INTEGER NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `ClientConversationTrack` ADD CONSTRAINT `ClientConversationTrack_client_id_fkey` FOREIGN KEY (`client_id`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailgunEmail` ADD CONSTRAINT `MailgunEmail_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `Client`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `MailgunEmailAttachment` ADD CONSTRAINT `MailgunEmailAttachment_mailgunEmailId_fkey` FOREIGN KEY (`mailgunEmailId`) REFERENCES `MailgunEmail`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ClientSmsAttachments` ADD CONSTRAINT `ClientSmsAttachments_client_sms_id_fkey` FOREIGN KEY (`client_sms_id`) REFERENCES `ClientSMS`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
