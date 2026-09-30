`alpha/authzattrs/v2/certificate.proto` is an exact copy from Alpha commit
`5993752cda4abfa61cbb5c925c991c37702ea031` (`proto/alpha/authzattrs/v2/certificate.proto`).
SHA-256: `7fea3e733818f58978215e409f78acb121010c19ef4b3282fee465ec72f9028e`.

Run `npm run generate:certificate` after updating the copied proto. Commit the
generated `src/lib/alpha/certificate.schema.json`; CI tests compare it with
the checked-in proto. This descriptor supplies every V2 field number.
