-- Drop existing tables if they exist
drop table if exists doctrines;
drop table if exists pages;
drop table if exists messages;

-- Create doctrines table
create table if not exists
  doctrines (
    id BIGSERIAL primary key,
    public_key text not null unique,
    doctrine_id integer not null unique,
    authority text not null,
    total_messages text not null,
    active_page_number integer,
    messages_per_page integer not null,
    current_page_message_count integer not null,
    current_message_cost text not null,
    pages text[] default array[]::text[], -- Array of page pubkeys
    created_at TIMESTAMPTZ not null default now(),
    updated_at TIMESTAMPTZ not null default now()
  );

create index if not exists idx_doctrines_public_key on doctrines(public_key);
create index if not exists idx_doctrines_doctrine_id on doctrines(doctrine_id);

-- Create messages table with updated schema
create table if not exists
  messages (
    doctrine_id integer not null,
    page_number integer not null,
    message_index integer not null,
    message text not null,
    ipfs_cid text not null,
    txid text,
    sender_pubkey text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    primary key (doctrine_id, page_number, message_index)
  );

create index if not exists idx_messages_doctrine_id on messages(doctrine_id);
create index if not exists idx_messages_txid on messages(txid);
create index if not exists idx_messages_sender_pubkey on messages(sender_pubkey);
