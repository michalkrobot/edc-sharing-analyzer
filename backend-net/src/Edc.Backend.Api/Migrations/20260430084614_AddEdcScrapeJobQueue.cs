using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Edc.Backend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddEdcScrapeJobQueue : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "edc_scrape_jobs",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    status = table.Column<string>(type: "text", nullable: false),
                    requested_date = table.Column<string>(type: "text", nullable: true),
                    requested_by = table.Column<string>(type: "text", nullable: true),
                    worker_id = table.Column<string>(type: "text", nullable: true),
                    attempt_count = table.Column<int>(type: "integer", nullable: false),
                    last_error = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false),
                    updated_at = table.Column<long>(type: "bigint", nullable: false),
                    claimed_at = table.Column<long>(type: "bigint", nullable: true),
                    finished_at = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_edc_scrape_jobs", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "edc_scrape_jobs");
        }
    }
}
