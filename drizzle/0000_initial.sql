PRAGMA foreign_keys = ON;

CREATE TABLE `crosswords` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `title` text NOT NULL,
  `kind` text NOT NULL,
  `theme_description` text DEFAULT '' NOT NULL,
  `rows` integer NOT NULL,
  `columns` integer NOT NULL,
  `word_bank` text DEFAULT '[]' NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE TABLE `areas` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` text NOT NULL,
  `crossword_id` integer NOT NULL,
  `kind` text NOT NULL,
  `row` integer NOT NULL,
  `column` integer NOT NULL,
  `row_span` integer DEFAULT 1 NOT NULL,
  `column_span` integer DEFAULT 1 NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `diagonal` text,
  FOREIGN KEY (`crossword_id`) REFERENCES `crosswords`(`id`) ON DELETE cascade
);

CREATE TABLE `clue_regions` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` text NOT NULL,
  `area_id` integer NOT NULL,
  `content` text DEFAULT '' NOT NULL,
  `is_thematic` integer DEFAULT 0 NOT NULL,
  `answer_length` integer DEFAULT 0 NOT NULL,
  `polygon` text NOT NULL,
  `position` integer NOT NULL,
  FOREIGN KEY (`area_id`) REFERENCES `areas`(`id`) ON DELETE cascade
);

CREATE TABLE `arrows` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` text NOT NULL,
  `clue_region_id` integer NOT NULL,
  `start_side` text NOT NULL,
  `end_direction` text NOT NULL,
  `position` integer NOT NULL,
  FOREIGN KEY (`clue_region_id`) REFERENCES `clue_regions`(`id`) ON DELETE cascade
);

CREATE TABLE `words` (
  `id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
  `client_id` text NOT NULL,
  `crossword_id` integer NOT NULL,
  `clue_region_id` integer NOT NULL,
  `answer` text DEFAULT '' NOT NULL,
  `cells` text NOT NULL,
  `direction` text NOT NULL,
  FOREIGN KEY (`crossword_id`) REFERENCES `crosswords`(`id`) ON DELETE cascade,
  FOREIGN KEY (`clue_region_id`) REFERENCES `clue_regions`(`id`) ON DELETE cascade
);

CREATE INDEX `idx_areas_crossword` ON `areas` (`crossword_id`);
CREATE INDEX `idx_regions_area` ON `clue_regions` (`area_id`);
CREATE INDEX `idx_arrows_region` ON `arrows` (`clue_region_id`);
CREATE INDEX `idx_words_crossword` ON `words` (`crossword_id`);
