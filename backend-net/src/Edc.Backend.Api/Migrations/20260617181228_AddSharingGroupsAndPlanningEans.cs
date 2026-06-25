using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Edc.Backend.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSharingGroupsAndPlanningEans : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "annual_kwh",
                table: "tenant_eans",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "current_group_name",
                table: "tenant_eans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "expected_kw",
                table: "tenant_eans",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<double>(
                name: "installed_kw",
                table: "tenant_eans",
                type: "double precision",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "is_producer",
                table: "tenant_eans",
                type: "boolean",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "planned_group_name",
                table: "tenant_eans",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "source_type",
                table: "tenant_eans",
                type: "text",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "sharing_groups",
                columns: table => new
                {
                    id = table.Column<int>(type: "integer", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tenant_id = table.Column<int>(type: "integer", nullable: false),
                    name = table.Column<string>(type: "text", nullable: false),
                    edc_group_id = table.Column<string>(type: "text", nullable: true),
                    created_at = table.Column<long>(type: "bigint", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_sharing_groups", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "IX_sharing_groups_tenant_id_name",
                table: "sharing_groups",
                columns: new[] { "tenant_id", "name" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "sharing_groups");

            migrationBuilder.DropColumn(
                name: "annual_kwh",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "current_group_name",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "expected_kw",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "installed_kw",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "is_producer",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "planned_group_name",
                table: "tenant_eans");

            migrationBuilder.DropColumn(
                name: "source_type",
                table: "tenant_eans");
        }
    }
}
