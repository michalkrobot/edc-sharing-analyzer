using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Edc.Backend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddTenantSharingCache : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // Pre-existing drift: SyntheticEan.SharingGroupId (commit 050f2de) nemel zadnou migraci.
            // Idempotentne, aby to neselhalo, kdyby uz sloupec v nejake DB existoval.
            migrationBuilder.Sql(
                "ALTER TABLE synthetic_eans ADD COLUMN IF NOT EXISTS sharing_group_id integer;");

            migrationBuilder.CreateTable(
                name: "tenant_sharing_cache",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    payload_json = table.Column<string>(type: "text", nullable: false),
                    interval_count = table.Column<int>(type: "integer", nullable: false),
                    computed_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_tenant_sharing_cache", x => x.tenant_id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "tenant_sharing_cache");

            migrationBuilder.Sql(
                "ALTER TABLE synthetic_eans DROP COLUMN IF EXISTS sharing_group_id;");
        }
    }
}
