CREATE TABLE ocv_q8.profile (
 session uuid PRIMARY KEY,
 nickname varchar(32) NOT NULL DEFAULT '',
 bio varchar(500) NOT NULL DEFAULT '',
 avatar bytea CHECK(octet_length(avatar)<=65536),
 two_factor boolean NOT NULL DEFAULT false,
 updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE ocv_q8.identity_slips (
 id uuid PRIMARY KEY,
 session uuid NOT NULL,
 kind varchar(12) NOT NULL CHECK(kind IN('email','phone','password','two-factor')),
 created_at timestamptz NOT NULL DEFAULT now()
);
