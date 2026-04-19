using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Edc.Backend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSyntheticEansAndPriorityLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "synthetic_eans",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    ean = table.Column<string>(type: "text", nullable: false),
                    label = table.Column<string>(type: "text", nullable: false),
                    is_producer = table.Column<bool>(type: "boolean", nullable: false),
                    installed_kw = table.Column<double>(type: "double precision", nullable: true),
                    annual_kwh = table.Column<double>(type: "double precision", nullable: true),
                    tdz_category = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_synthetic_eans", x => new { x.tenant_id, x.ean });
                });

            migrationBuilder.CreateTable(
                name: "priority_links",
                columns: table => new
                {
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    producer_ean = table.Column<string>(type: "text", nullable: false),
                    consumer_ean = table.Column<string>(type: "text", nullable: false),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_priority_links", x => new { x.tenant_id, x.producer_ean, x.consumer_ean });
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(name: "synthetic_eans");
            migrationBuilder.DropTable(name: "priority_links");
        }
    }
}
